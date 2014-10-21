'use strict';

var split = require('split');
var inherits = require('util').inherits;
var AbstractConnection = require('abstract-skiff-transport').Connection;
var reconnect = require('reconnect-net');

module.exports = Connection;

function Connection(localNodeId, options, connection) {
  AbstractConnection.call(this);

  this.localNodeId = localNodeId;
  this.options = options;

  if (connection) {
    this._c = connection;
    this._server = true;
    this._onConnect(connection);
  }

}

inherits(Connection, AbstractConnection);

var C = Connection.prototype;

C._onceConnected = function _onceConnected(cb) {
  if (!this.server && !this._r) {
    this._r = this._reconnect();
  }
  if (this._c) {
    cb(this._c);
  }
  else if (!this._server) {
    this._r.once('connect', cb);
  }
};

C._reconnect = function _reconnect() {
  var self = this;

  var r = reconnect(onConnect);
  r.connect(this.options.port, this.options.hostname);
  r.on('disconnect', onDisconnect);

  function onConnect(c) {
    self.state = 'connected';
    self._c = c;
    self._onConnect(c);
  }

  function onDisconnect() {
    self.state = 'disconnected';
    self._c = undefined;
  }

  return r;
};

C._onConnect = function _onConnect(c) {
  var self = this;

  c.pipe(split()).on('data', onLineData);

  function onLineData(l) {
    var d;
    if (l) {
      try {
        d = JSON.parse(l);
      } catch (err) {
        self.emit('error', err);
      }
      if (d !== undefined) {
        if (d.response) {
          self.emit('response', d.response);
        }
        else if (d.request) {
          self.emit('request', d.request);
        }
        else if (d.hello) {
          self.helloBack(d.hello);
        }
        else if (d.helloback) {
          self.emit('handshake', d.helloback);
        }
      }
    }
  }
};

C._close = function _close(cb) {
  var calledback = false;

  if (this._r) {
    this._r.disconnect();
    if (this.state == 'disconnected') {
      setImmediate(cb);
    } else {
      this._r.once('disconnect', closed);
    }
  }
  if (this._c) {
    this._c.once('close', closed);
    this._c.end();
  }

  function closed() {
    if (!calledback) {
      calledback = true;
      if (cb) {
        cb();
      }
    }
  }
};

C._send = function _send(type, args, cb) {
  var self = this;
  this._onceConnected(function(c) {
    self.once('response', onResponse);
    c.write(JSON.stringify({request: [type, args]}) + '\n');
  });

  function onResponse(d) {
    cb(null, d);
  }
};

C._receive = function _receive(fn) {
  var self = this;
  this.on('request', onRequest);

  function onRequest(args) {
    fn.call(null, args[0], args[1], onReply);
  }

  function onReply() {
    var args = Array.prototype.slice.call(arguments);
    self._onceConnected(function(c) {
      c.write(JSON.stringify({response: args}) + '\n');
    });
  }
};

C.helloBack = function helloBack(peerId) {
  var self = this;

  this.remotePeerId = peerId;
  self._onceConnected(function(c) {
    c.write(JSON.stringify({helloback: self.localNodeId}) + '\n');
  });
};

C.handshake = function handshake(cb) {
  var self = this;

  this.once('handshake', handshook);

  this._onceConnected(function(c) {
    c.write(JSON.stringify({hello: self.localNodeId}) + '\n');
  });

  function handshook(peerId) {
    self.remotePeerId = peerId;
    cb(null, peerId);
  }
};
