# skiff-tcp-nlsjson

[![Dependency Status](https://david-dm.org/pgte/skiff-tcp-nlsjson.svg)](https://david-dm.org/pgte/skiff-tcp-nlsjson)
[![Build Status](https://travis-ci.org/pgte/skiff-tcp-nlsjson.svg?branch=master)](https://travis-ci.org/pgte/skiff-tcp-nlsjson)

New-line separated JSON over TCP transport for Skiff.

## Install

```bash
$ npm install skiff-tcp-nlsjson --save
```

## Use

```javascript
var Transport = require('skiff-tcp-nlsjson');
var transport = new Transport();

var Node = require('skiff');
var node = Node({
  transport: transport,
  // ...
});
```

# License

ISC