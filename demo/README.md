# clasp DEMO on Gitpod

This is an instructional demo.
You can try some operations on Gitpod.

[![Open in Gitpod](https://gitpod.io/button/open-in-gitpod.svg)](https://gitpod.io/#https://github.com/google/clasp/blob/master/demo/)

## Preparation

Change to the `demo` directory with the following command:

```shell
cd demo
```

## Login

```shell
clasp login --no-localhost
```

In this case, use `--no-localhost` because gitpod cannot login using localhost.

## Create a New Project

```shell
clasp create --title "Clasp Demo" --type standalone
```

You can check the created project with the following command:

```shell
clasp open
```

## Pushing Files

```shell
clasp push
```
