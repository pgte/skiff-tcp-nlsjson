'use strict';

var inherits = require('util').inherits;
var AbstractTransport = require('abstract-skiff-transport').Transport;
var Connection = require('./connection');

module.exports = SkiffTcpNlsJson;

function SkiffTcpNlsJson() {
  AbstractTransport.call(this);
}

inherits(SkiffTcpNlsJson, AbstractTransport);

var STNJ = SkiffTcpNlsJson.prototype;

STNJ._connect = function _connect(options) {
  return new Connection(options);
};
