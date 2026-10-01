# Learnings

- 2026-10-01: `node --test tools/` fails on Node 22 ("Cannot find module …/tools") but passes on Node 18 and 26; the publish workflow runs Node 22 while CI runs 18, so pass test files (`node --test tools/*.test.mjs`) and do not trust a green CI or local run as proof the publish workflow will pass.
