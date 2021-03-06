/*! then-route - 0.1.1 - Bernard McManus - master - gc70ccc - 2015-04-22 */

(function() {
    "use strict";
    var requires$$url = require( 'url' );
    var requires$$path = require( 'path' );
    var requires$$querystring = require( 'querystring' );
    var requires$$util = require( 'util' );
    var requires$$E$ = require( 'emoney' );
    var requires$$briskit = require( 'briskit' );
    var requires$$extend = require( 'extend' );
    var requires$$Promise = require( 'es6-promise' ).Promise;
    var requires$$colors = require( 'colors' );
    function request$handler$$RequestHandler( pattern ) {
      var that = this;
      that.go = [];
      that.stop = [];
      that.pattern = request$handler$$ParsePattern( pattern );
      requires$$E$.construct( that );
    }

    var request$handler$$default = request$handler$$RequestHandler;

    request$handler$$RequestHandler.prototype = requires$$E$.create({
      testRoute: router$$testRoute,
      then: request$handler$$then,
      'catch': request$handler$$$catch,
      exec: request$handler$$exec,
      _tic: request$handler$$_tic
    });

    function request$handler$$ParsePattern( pattern ) {
      var reTerminate = /\*$/;
      var reExclusive = /\/\*?$/;
      var terminate = false;
      var exclusive = false;
      if (typeof pattern == 'string') {
        terminate = !reTerminate.test( pattern );
        exclusive = reExclusive.test( pattern );
        pattern = pattern
          .replace( reTerminate , '' )
          .replace( reExclusive , function( match ) {
            return terminate ? '' : match;
          });
      }
      return router$$BuildRegexp( pattern , { terminate: terminate, exclusive: exclusive });
    }

    function request$handler$$then( handler ) {
      var that = this;
      that.go.push( handler );
      return that;
    }

    function request$handler$$$catch( handler ) {
      var that = this;
      that.stop.push( handler );
      return that;
    }

    function request$handler$$exec( req , res ) {
      var that = this;
      var go = that.go.slice( 0 );
      return new requires$$Promise(function( resolve ) {
        switch (req.method.toLowerCase()) {
          case 'get':
            resolve();
          break;
          case 'post':
            if (req.$body.length) {
              req.on( 'data' , function( chunk ) {
                that.$emit( 'chunk' , { req: req, chunk: chunk });
              });
              req.on( 'end' , resolve );
            }
            else {
              resolve();
            }
          break;
          default:
            resolve();
          break;
        }
      })
      .then(function() {
        return new requires$$Promise(function( resolve , reject ) {
          that.$emit( 'end' , { req: req } , resolve );
          reject();
        })
        .then(function() {
          return that._tic( go , req , res );
        });
      })
      .catch(function( err ) {
        var stop = that.stop.slice( 0 );
        if (err instanceof Error) {
          that.$emit( 'error' , { req: req, err: err });
        }
        if (stop.length) {
          return that._tic( stop , req , res , err );
        }
        else {
          res.writeHead( 500 , { 'Content-Type': 'text/plain' });
          res.end( '500 Internal Server Error\n' );
        }
      });
    }

    function request$handler$$_tic( handlers , req , res , err ) {
      var that = this;
      var func = handlers.shift();
      return new requires$$Promise(function( resolve , reject ) {
        var args = [ req , res ];
        res.$go = function() {
          that.$emit( 'go' , { res: res });
          resolve.apply( null , arguments );
        };
        res.$stop = function() {
          that.$emit( 'stop' , { res: res });
          reject.apply( null , arguments );
        };
        if (err) {
          args.push( err );
        }
        func.apply( null , args );
      })
      .then(function() {
        if (handlers.length) {
          return that._tic( handlers , req , res );
        }
      });
    }

    function router$$Router( base , config ) {

      var that = this;
      var get = [];
      var post = [];
      var options = [];
      var rescue = [];
      /*var $else = new RequestHandler().then(function( req , res ) {
        var body = '404 Not Found\n';
        res.writeHead( 404 , {
          'Content-Type': 'text/plain',
          'Content-Length': body.length
        });
        res.end( body );
      });

      get.else = $else;
      post.else = $else;*/

      get.else = new request$handler$$default().then(function( req , res ) {
        var body = '404 Not Found\n';
        res.writeHead( 404 , {
          'Content-Type': 'text/plain',
          'Content-Length': body.length
        });
        res.end( body );
      });

      post.else = new request$handler$$default().then(function( req , res ) {
        var body = '404 Not Found\n';
        res.writeHead( 404 , {
          'Content-Type': 'text/plain',
          'Content-Length': body.length
        });
        res.end( body );
      });

      options.else = new request$handler$$default().then(function( req , res ) {
        res.end();
      });

      rescue.else = new request$handler$$default().then(function( req , res ) {
        res.end();
      });

      that.verbose = true;
      that.pattern = router$$BuildRegexp( base || '/' , { anchor: true });
      that.routes = {
        get: get,
        post: post,
        options: options,
        rescue: rescue
      };

      requires$$extend( that , config );
      
      requires$$E$.construct( that );
      that.$when();
    }

    router$$Router.prototype = requires$$E$.create({
      get: router$$get,
      post: router$$post,
      options: router$$options,
      testRoute: router$$testRoute,
      handle: router$$handle,
      augment: router$$augment,
      handleE$: router$$handleE$,
      destroy: router$$destroy,
      _addRoute: router$$_addRoute,
      _handleHTTP: router$$_handleHTTP,
      _handleRequestHandler: router$$_handleRequestHandler
    });

    function router$$BuildRegexp( pattern , options ) {

      var defaults = {
        anchor: false,
        terminate: false,
        exclusive: false,
        modifiers: undefined
      };
      
      pattern = pattern || /.*/;
      options = requires$$extend( defaults , options );

      var prefix = options.anchor ? '^' : '';
      var suffix = options.terminate ? '\\/?$' : (options.exclusive ? '.+' : '');

      if (typeof pattern == 'string') {
        pattern = pattern.replace( /[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g , '\\$&' );
        return new RegExp(( prefix + pattern + suffix ) , options.modifiers );
      }
      return pattern;
    }

    function router$$printStack( err ) {
      var stack = err.stack.split( '\n' );
      var message = stack.shift();
      stack = stack.join( '\n' );
      requires$$util.puts( requires$$colors.red( message ));
      requires$$util.puts( requires$$colors.gray( stack ));
    }

    function router$$testRoute( pathname ) {
      var that = this;
      return that.pattern.test( pathname );
    }

    function router$$get( pattern ) {
      var that = this;
      return that._addRoute( 'get' , pattern );
    }

    function router$$post( pattern ) {
      var that = this;
      return that._addRoute( 'post' , pattern );
    }

    function router$$options( pattern ) {
      var that = this;
      return that._addRoute( 'options' , pattern );
    }

    function router$$_addRoute( type , pattern ) {
      var that = this;
      var reqhandler = new request$handler$$default( pattern );
      that.$watch( reqhandler );
      that.routes[type].push( reqhandler );
      return reqhandler;
    }

    function router$$handle( req , res ) {
      var that = this;
      var parsed = requires$$url.parse( req.url );
      that.$emit( req.method.toLowerCase() , [ req , res , parsed ]);
    }

    function router$$augment( req , res , parsed ) {
      
      var that = this;
      var length = parseInt( req.headers[ 'content-length' ] , 10 ) || 0;

      requires$$extend( req , {
        $path: decodeURIComponent( parsed.pathname ),
        $search: parsed.search,
        $body: req.$body || new Buffer( length ),
        $_buffIndex: 0,
        $_data: parsed.query
      });

      if (!req.$data) {
        Object.defineProperty( req , '$data' , {
          get: function() {
            var data;
            try {
              if (req.$body.length) {
                data = req.$body.toString( 'utf-8' );
              }
              else {
                data = req.$_data;
              }
              data = requires$$querystring.parse( data );
            }
            catch( err ) {
              router$$printStack( err );
              data = {};
            }
            finally {
              return data;
            }
          }
        });
      }

      requires$$extend( res , {
        $engage: function( data ) {
          res.$data = res.$data || {};
          res.$busy = true;
          requires$$extend( res.$data , data );
        },
        $busy: false
      });
    }

    function router$$handleE$( e ) {
      var that = this;
      if (e.target === that) {
        that._handleHTTP.apply( that , arguments );
      }
      else if (e.target instanceof request$handler$$default) {
        that._handleRequestHandler.apply( that , arguments );
      }
    }

    function router$$_handleHTTP( e , req , res , parsed ) {
      
      var that = this;
      var routes = that.routes[e.type] || that.routes.rescue;
      var reqhandler;
      var i = 0;
      var len = routes.length;

      that.augment( req , res , parsed );

      if (that.testRoute( parsed.pathname )) {
        for (; i < len; i++) {
          reqhandler = routes[i];
          if (reqhandler.testRoute( parsed.pathname ) && !res.$busy) {
            reqhandler.exec( req , res );
          }
        }
      }

      requires$$briskit(function() {
        if (!res.$busy) {
          routes.else.exec( req , res );
        }
      });
    }

    function router$$_handleRequestHandler( e , data ) {
      var that = this;
      switch (e.type) {
        case 'error':
          if (that.verbose) {
            router$$printStack( data.err );
          }
        break;
        case 'chunk':
          (function( req , chunk ) {
            var offset = req.$_buffIndex;
            for (var i = 0; i < chunk.length; i++) {
              req.$body[i + offset] = chunk[i];
            }
            req.$_buffIndex = i;
          }( data.req , data.chunk ));
        break;
        case 'go':
        case 'stop':
          data.res.$engage();
        break;
        case 'end':
          // do something on response end
        break;
      }
    }

    function router$$destroy() {
      var that = this;
      that.$dispel( null , true );
    }

    router$$Router.printStack = router$$printStack;

    var $$index$$default = router$$Router;

    if (typeof define == 'function' && define.amd) {
      define([], function() { return $$index$$default });
    }
    else {
      module.exports = $$index$$default;
    }
}).call(this);

