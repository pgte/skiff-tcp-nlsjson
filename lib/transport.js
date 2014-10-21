'use strict';

var net = require('net');
var inherits = require('util').inherits;
var AbstractTransport = require('abstract-skiff-transport').Transport;
var Connection = require('./connection');

module.exports = SkiffTcpNlsJson;

function SkiffTcpNlsJson() {
  AbstractTransport.call(this);
}

inherits(SkiffTcpNlsJson, AbstractTransport);

var STNJ = SkiffTcpNlsJson.prototype;

STNJ._protocolName = function() {
  return 'tcp+nlsjson';
};

STNJ._connect = function _connect(localNodeId, remoteAddress) {
  return new Connection(localNodeId, remoteAddress);
};

STNJ._listen = function _listen(localNodeId, remoteAddress, listener) {
  if (!this._server) {
    this._server = net.createServer(onConnection);
  }
  this._server.listen(
    remoteAddress.port,
    remoteAddress.hostname);

  function onConnection(conn) {
    conn.on('error', function() {
      // don't care about error
    });
    var c = new Connection(localNodeId, {}, conn);
    c.once('hello', onHello);

    function onHello(peerId) {
      listener.call(null, peerId, c);
    }
  }
};
