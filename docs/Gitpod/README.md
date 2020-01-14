# clasp DEMO on gitpod

This is an instructional demo.
You can try some operations on gitpod.

[![Open in Gitpod](https://gitpod.io/button/open-in-gitpod.svg)](https://gitpod.io/#https://github.com/google/clasp/blob/master/docs/Gitpod/)

## Preparation

Change to the `docs/Gitpod/` directory with the following command:

```
cd docs/Gitpod/
```

## Login

```
clasp login --no-localhost
```

In this case, use `--no-localhost` because gitpod cannot login using localhost.

## Create a New Project

```
clasp create --title "Clasp Demo" --type standalone
```

You can check the created project with the following command:

```
clasp open
```

## Pushing Files

```
clasp push
```