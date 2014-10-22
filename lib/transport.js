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

STNJ._listen = function _listen(localNodeId, remoteAddress, listener, cb) {
  var server;
  var closing = false;

  if (!this._server) {

    this._server = server = net.createServer(onConnection);
    server.__connections = [];

    server.on('connection', function(c) {
      if (!closing) {
        server.__connections.push(c);
        c.once('close', function() {
          var idx = server.__connections.indexOf(c);
          if (idx > -1) {
            server.__connections.splice(idx, 1);
          }
        });
      }
    });

    var serverClose = server.close;
    server.close = function close(cb) {
      closing = true;
      serverClose.call(server, closed);
      server.__connections.forEach(function(c) {
        c.end();
      });

      function closed() {
        if (cb) {
          cb();
        }
      }
    };
  }

  this._server.listen(
    remoteAddress.port,
    remoteAddress.hostname, cb);

  function onConnection(conn) {
    if (closing) {
      c.end();
    } else {
      conn.on('error', function() {
        // don't care about error
      });
      var c = new Connection(localNodeId, {}, conn);
      c.once('hello', onHello);
    }

    function onHello(peerId) {
      listener.call(null, peerId, c);
    }
  }

  return this._server;
};
