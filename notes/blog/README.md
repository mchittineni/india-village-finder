# Blog drafts — ready to post manually

Five stand-alone posts about the project, each aimed at a different audience.
Copy the body of any file straight into dev.to / Medium / Hashnode. Suggested
title and tags are in each file's frontmatter-style header comment.

| #   | File                          | Angle / audience                                                     |
| --- | ----------------------------- | -------------------------------------------------------------------- |
| 1   | `01-project-intro.md`         | Flagship intro — what Village Finder is, for general dev readers     |
| 2   | `02-gov-data-war-stories.md`  | Data-engineering war stories — devs who scrape government data       |
| 3   | `03-serverless-on-github.md`  | Architecture — running a self-updating data site on GitHub alone     |
| 4   | `04-farming-features.md`      | Civic-tech / agritech — the farmer-facing features and their sources |
| 5   | `05-native-names-at-scale.md` | i18n deep-dive — native-script names for 68,000 villages             |

Posting tips:

- On **dev.to**, set the canonical URL to the repo (or a release) if you also
  post elsewhere; 4 tags max.
- On **Medium**, paste the Markdown into a story or use _Import a story_ on the
  dev.to URL after publishing there (the importer sets the canonical link).
- Space them out (one a week works well) and lead with post 1 or 2.
- `publish-blog.yml` handles _release_ announcements automatically; these are
  the evergreen pieces.
