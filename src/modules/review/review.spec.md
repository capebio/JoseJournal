# Review module — spec (§3.10, §7, §9.6)

## Goal
Continuous, transparent review for Knowledge Objects: traffic-light reviewer
dispositions with open identity, author right-of-reply, and a release gate; plus
co-author consent (no silent enrolment as an author). Every action is provenanced.

## Constraints
- Inject only `PORTS.ReviewRepo`, `PORTS.ConsentRepo`, and `ProvenanceService`
  (never a DB directly). Both in-memory and live adapters implement the ports.
- Reviewer identity is open: the submitting reviewer is `user.accountId`.
- Endpoints and guards are exactly as §7 specifies (see below). Auth is global;
  these are protected writes (`@Roles` / `@MinAssurance`), none are `@Public`.
- IDs: `mintId('review')` for threads, `mintId('consent')` for consent.
- Deterministic: no network, no `Date.now` reliance beyond `new Date()`.

## Endpoints (§7)
| Method/path | Guard | Effect |
| --- | --- | --- |
| `POST /ko/:koId/reviewers` | `@Roles('author','editor','steward')` | Create `ReviewThread` (`review:…`), disposition `yellow`, empty comment, advisory `relevanceScore` in [0,1]. |
| `POST /ko/:koId/review` | `@Roles('reviewer','editor','steward')` | Submit/update `{threadId?, disposition, comment}`; reviewer = caller. |
| `POST /ko/:koId/review/:threadId/reply` | `@Roles('author','editor','steward')` | Author right-of-reply (required for orange/red). |
| `POST /ko/:koId/coauthors` | `@Roles('author','editor','steward')` | `CoauthorConsent` (`consent:…`), state `named-unconfirmed`, deadline now+14d. |
| `POST /ko/:koId/coauthors/:id/respond` | `@MinAssurance('verified')` | Update consent state + `resolvedAt`. |

## Release gate (§9.6)
`ReviewService.releaseBlockers(koId): Promise<ReviewThread[]>` returns threads
whose disposition is `orange` or `red` AND whose `authorReply` is empty/absent.
The orchestrator calls this to gate releases; non-empty = blocked.

## Edge cases
- Updating a thread to a different disposition resets `authorReply` to `null`, so a
  stale reply cannot silently clear a freshly raised orange/red finding.
- A whitespace-only reply does not count as a reply (still a blocker).
- `reply` and `respondCoauthor` 404 on unknown ids; `reply` also checks `koId`.

## Success criteria
- orange/red with no reply → `releaseBlockers` non-empty; after a real reply → empty.
- A co-author candidate who has not responded reads `named-unconfirmed`.
- Provenance recorded on every action (reviewer-assigned, disposition, author-reply,
  consent-requested, consent-resolved). Covered by `review.spec.ts`.
