<h1 align="center">
	<img width="320" src="assets/logo.svg" alt="m8t">
</h1>

# m8t

[![Publish](https://github.com/thegedge/m8t/actions/workflows/publish.yaml/badge.svg)](https://github.com/thegedge/m8t/actions/workflows/publish.yaml)
[![NPM Downloads](https://img.shields.io/npm/dm/m8t)](https://www.npmjs.com/package/m8t)
[![NPM Unpacked Size](https://img.shields.io/npm/unpacked-size/m8t)](https://www.npmjs.com/package/m8t)

> A minimal static site generator. Your best friend.

"m8t", pronounced "mate", is yet another static site generator, built to power the original author's
[website](https://gedge.ca).

<!-- prettier-ignore-start -->
> [!NOTE]
> This project is currently being developed and will hopefully be generally available by late Summer 2025
<!-- prettier-ignore-end -->

## Core values

- **Simplicity**. The core should be as light as possible, satisfying the needs of most out of the box, and with a
  mental model that's easy to understand.
- **Easy to extend**. The defaults should suit most needs, but following the
  [Open-closed principle](https://en.wikipedia.org/wiki/Open%E2%80%93closed_principle), anyone needing to extend the
  core should be able to do so.
- **Truly static output**. You should be able to take the output of m8t and put it anywhere that can host static sites.
  There should be no need for functions or compute.
- **Lightweight output**. m8t does as little as possible when transforming, and should output just the stuff you need.

m8t's values are inspired by other technologies like [Express](https://expressjs.com/),
[Sinatra](https://sinatrarb.com/), [Flask](https://flask.palletsprojects.com/en/stable/), and
[Lume](https://lume.land/).

## Why the name?

"m8t" is a numerical contraction of "minimalist", which is one of the values of this static site generator.
