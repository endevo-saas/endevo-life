# HEAL CHECK 4 — amplify.yml

## Root `amplify.yml` (committed)

```yaml
version: 1
applications:
  - appRoot: apps/web
    frontend:
      phases:
        preBuild:
          commands:
            - cd $CODEBUILD_SRC_DIR/endevo-life && npm install --legacy-peer-deps
        build:
          commands:
            - cd $CODEBUILD_SRC_DIR/endevo-life && NEXT_PUBLIC_API_URL=https://4jms6sdzk9.execute-api.us-east-1.amazonaws.com NEXT_PUBLIC_BOOKING_LINK=https://link.endevo.life/widget/booking/HUYkq6QZs0fI7AMtt6qH npx turbo run build --filter=@endevo/web
      artifacts:
        baseDirectory: .next
        files:
          - '**/*'
      cache:
        paths:
          - node_modules/**/*
          - apps/web/.next/cache/**/*
      buildSettings:
        platform: WEB_COMPUTE
```

## `apps/web/amplify.yml`
NOT FOUND.

## Console-level `buildSpec` (stored on Amplify app, overrides repo)

```yaml
preBuild:
  commands: ['cd $CODEBUILD_SRC_DIR/endevo-aws-shahzad && npm install --legacy-peer-deps']
build:
  commands: ['cd $CODEBUILD_SRC_DIR/endevo-life && npm install --legacy-peer-deps && npx turbo run build --filter=@endevo/web']
```

Note: the console-level `buildSpec` has a pre-existing bug — it `cd`s into
`endevo-aws-shahzad` during preBuild (which doesn't exist, silently no-ops). That
doesn't block the build; the build phase still correctly targets `endevo-life`.

## Observation
`appRoot: apps/web` plus `cd $CODEBUILD_SRC_DIR/endevo-life` is slightly redundant, but
not the root cause. Paths work because the repo is cloned into `endevo-life/`.
