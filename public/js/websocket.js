/*

  Whisk Client Library

  Whisk.WebSocket attributes:

    ws_token - generated by whisk, links the web client with the whisk websocket service
    sio - socket.io websocket connection
    is_ready - set to true once all is initialized

*/


(function (whisk) {
  var WS = (whisk.WebSocket = {});

  // attributes

  WS.ws_token = undefined;
  WS.sio = undefined;
  WS.initializing_routes = false;
  WS.tearing_down_routes = false;
  WS.is_ready = false;
  WS.config = { websocket: {port: 80} };
  WS.auth_requested = false;
  WS.auth_accepted = false;
  WS.auth_error = false;


  // init

  WS.init = function (attr, cb) {
    console.log('Whisk.WebSocket.init');

    /* attrs:
        config
          websocket
        ws_token - used to authenticate the client
        routes

          base - base socket.io websocket routes
            <ROUTE_NAME>
              handler - overload the route entirely
              cb - callback after execution

          whisk - whisk websocket routes
            <ROUTE_NAME>
              handler- overload the route entirely
              cb - callback after execution

          app - implementation-defined websocket routes
            <ROUTE_NAME>
              handler - define a custom route

    */

    if (!attr) { attr = {}; }

    if (attr.config && attr.config.websocket && attr.config.websocket.port) {
      WS.config.websocket.port = attr.config.websocket.port;
    }

    if (attr.ws_token) {
      WS.ws_token = attr.ws_token;
    }

    var domain_name = window.location.hostname;
    var port = WS.config.websocket.port;


    // expunge any previously running websockets
    delete io.sockets['ws://' + domain_name + ':' + port];
    io.j =[];

    // establish an engine.io websocket connection
    var sio = Whisk.WebSocket.sio = new io.connect('ws://' + domain_name + ':' + port + '/');
    console.log('Whisk.Websocket.init: establishing new websocket connection to ' + 'ws://' + domain_name + ':' + port + '/');

    // on connection
    sio.on('connect', function () {
      console.log('Whisk.WebSocket: on websocket connect');

      // initiate the base routes
      WS.init_routes({ route_group: 'base', routes: attr.routes ? attr.routes.base : undefined });

      // initiate the whisk routes
      WS.init_routes({ route_group: 'whisk', routes: attr.routes ? attr.routes.whisk : undefined });


      // if there is no ws_token, start fetching one immediately
      if (!WS.ws_token) {
        console.log('Whisk.Websocket: on websocket connect: no ws_token found; will now fetch one using the API.');

        // start getting the ws session token if it is not in place
        jQuery.ajax({
          type: 'GET', url: "/rapt-whisk-router/api/renew_ws_session",
          success: function(payload) {
            console.log('Whisk.Websocket: on websocket connect: renewal initiated...');
            
            // make sure the payload is ok
            if (payload && payload.ws_token) {

              // make sure the user is correct
              if (payload.user_id == Whisk.Model.user.id) {
                console.log('Whisk.Websocket: on websocket connect: renewal initiated... ws_token=' + payload.ws_token + ' has been set!');
                WS.ws_token = payload.ws_token;

                // initialize this application's websocket routes
                WS.init_routes({ route_group: 'app', routes: attr.routes ? attr.routes.app : undefined });

              }

            }
          },
        });

      // ws session token is present
      } else {

        // initialize this application's websocket routes
        WS.init_routes({ route_group: 'app', routes: attr.routes ? attr.routes.app : undefined  });

      }

      WS.is_ready = true;

      // final callback
      if (cb) { cb(); }

    });

  }; // END init


  // tear down
  // NOTE: for testing reconnects

  WS.tear_down = function () {
    console.log('Whisk.Websocket.tear_down');

    var domain_name = window.location.hostname;
    var port = WS.config.websocket.port;

    // disconnect
    if (Whisk.WebSocket.sio) {
      Whisk.WebSocket.sio.disconnect();
    }

  }


  // init routes
  // connects the WS.<ROUTE_GROUP>_route_handlers to socket.io on-listeners

  WS.init_routes = function (attr) {
    console.log('Whisk.Websocket.init_routes');

    /* attrs:
        route_group - name of hash containing routes
        routes - handlers and callbacks by route name
          <ROUTE_NAME>
            handler
            cb
    */

    WS.initializing_routes = true;

    console.log('Whisk.WebSocket.init_routes: initialize routes for the ' + attr.route_group + ' group');
    
    var route_ids, route_id;
    
    // deal with implementation-based route overloads and callbacks

    if (attr.routes) {

      route_ids = Object.keys(attr.routes);
      
      for (var r=0; r < route_ids.length; r++) {
        route_id = route_ids[r];

        // overloaded or defined route
        
        if (attr.routes[route_id].handler) {
          if (WS[attr.route_group + '_route_handlers'][route_id]) {
            console.log('Whisk.WebSocket.init_routes: overload route=' + route_id);
          } else {
            console.log('Whisk.WebSocket.init_routes: define route=' + route_id);
          }
          WS[attr.route_group + '_route_handlers'][route_id] = attr.routes[route_id].handler;

        }

        // overloaded or defined callback
        if (attr.routes[route_id].cb) {
          if (WS[attr.route_group + '_route_cbs'][route_id]) {
            console.log('Whisk.WebSocket.init_routes: overload the cb for route=' + route_id);
          } else {
            console.log('Whisk.WebSocket.init_routes: define cb for route=' + route_id);
          }
          WS[attr.route_group + '_route_cbs'][route_id] = attr.routes[route_id].cb;

        }
      }

    }


    // start listening

    route_ids = Object.keys(WS[attr.route_group + '_route_handlers']);
    for (var r=0; r < route_ids.length; r++) {
      console.log('Whisk.WebSocket.init_routes: listen on route=' + route_ids[r]);

      // listen on the route
      route_id = route_ids[r];
      WS.sio.on(route_id, WS[attr.route_group + '_route_handlers'][route_id]);

    }

    WS.initializing_routes = false;

  };


  // tear_down routes
  // disconnects the WS.<ROUTE_GROUP>_route_handlers from socket.io on-listeners

  WS.tear_down_routes = function (attr) {
    console.log('Whisk.Websocket.tear_down_routes');

    /* attrs:
        route_group - name of hash containing routes
    */

    WS.tearing_down_routes = true;

    var route_ids = Object.keys(WS[attr.route_group + '_route_handlers']);
    for (var r=0; r < route_ids.length; r++) {
      console.log('Whisk.Websocket.tear_down_routes: removed handler for route=' + route_ids[r]);

      // remove the listener on the route
      var route_id = route_ids[r];
      WS.sio.removeListener(route_id, WS[attr.route_group + '_route_handlers'][route_id]);

      // NOTE: this will be re-established when init is re-called
    }

    WS.tearing_down_routes = false;

  }


  /*
    base route handlers (socket.io hooks)
  */


  WS.base_route_handlers = {

    // disconnect

    'disconnect': function (reconnectionDelay, reconnectionAttempts) {
      console.log('Whisk.Websocket: on disconnect');

      // invalidate the ws_token
      WS.ws_token = undefined;

      // tear down the websocket routes
      WS.tear_down_routes({ route_group:'base' });
      WS.tear_down_routes({ route_group:'whisk' });
      WS.tear_down_routes({ route_group:'app' });

      // callback
      if (WS.base_route_cbs.disconnect) {
        WS.base_route_cbs.disconnect(null);
      }

    },


    // reconnecting

    'reconnecting': function () {
      console.log('Whisk.Websocket: on reconnecting');

      // callback
      if (WS.base_route_cbs.reconnecting) {
        WS.base_route_cbs.reconnecting(null);
      }

    },


    // reconnect

    'reconnect': function (reconnectionDelay, reconnectionAttempts) {
      console.log('Whisk.Websocket: on reconnect');

      // callback
      if (WS.base_route_cbs.reconnect) {
        WS.base_route_cbs.reconnect(null);
      }

    },


    // close

    'close': function () {
      console.log('Whisk.Websocket: on close');

      // callback
      if (WS.base_route_cbs.close) {
        WS.base_route_cbs.close(null);
      }

    },

  }; // END base routes definition


  // base route callbacks

  WS.base_route_cbs = {

    // disconnect callback

    'disconnect': function (err) {
      console.log('Whisk.Websocket: on disconnect callback');
    },


    // reconnecting callback

    'reconnecting': function (err) {
      console.log('Whisk.Websocket: on reconnecting callback');
    },


    // reconnect callback

    'reconnect': function (err) {
      console.log('Whisk.Websocket: on reconnect callback');
    },


    // close callback

    'close': function (err) {
      console.log('Whisk.Websocket: on close callback');
    },

  }; // END base route callbacks definition


  /*
    whisk route handlers
  */


  WS.whisk_route_handlers = {

    // auth request

    'whisk.auth.request': function (payload, cb) {
      console.log('Whisk.Websocket: on whisk.auth.request with payload ', payload);
      
      WS.auth_requested = true;

      // reply
      cb({ ws_token: WS.ws_token });

      // callback
      if (WS.whisk_route_cbs['whisk.auth.request']) {
        WS.whisk_route_cbs['whisk.auth.request'](null);
      }

    },


    // auth error

    'whisk.auth.error': function (payload) {
      console.error('Whisk.Websocket: on whisk.auth.error: ', payload);
      
      WS.auth_error = true;

      // callback
      if (WS.whisk_route_cbs['whisk.auth.error']) {
        WS.whisk_route_cbs['whisk.auth.error'](null);
      }

    },


    // auth accept

    'whisk.auth.accept': function (payload, cb) {
      console.log('Whisk.Websocket: on whisk.auth.accept');

      WS.auth_accepted = true;

      // callback
      if (WS.whisk_route_cbs['whisk.auth.accept']) {
        WS.whisk_route_cbs['whisk.auth.accept'](null);
      }

    },


  }; // END whisk routes definition


  // base route callbacks

  WS.whisk_route_cbs = {

    // whisk auth request callback

    'whisk.auth.request': function (err) {
      console.log('Whisk.Websocket: on whisk.auth.request callback');
    },


    // whisk auth error callback

    'whisk.auth.error': function (err) {
      console.log('Whisk.Websocket: on whisk.auth.error callback');
    },


    // whisk auth accept callback

    'whisk.auth.accept': function (err) {
      console.log('Whisk.Websocket: on whisk.auth.accept_cb callback');
    },


  }; // END whisk route callbacks definition



  /*
    application route handlers

    NOTE: these are entirely defined in the implementation

  */


  WS.app_route_handlers = {

  }; // END application routes definition


  WS.app_route_cbs = {

  } // END application route callbacks


}) (( window.Whisk=window.Whisk || {}));