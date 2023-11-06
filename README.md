# Express2Koa
怎么让`Express`拥有和`Koa`一样的洋葱模型

# Koa源码分析
项目源代码
```js
const Koa = require('koa')

const app = new Koa();

app.use(async middleware1(ctx, next) => {
    console.log(1);
    const a = await next();
    console.log(a);
    console.log(2);
    ctx.body = `
    打印
    1
    3
    5
    4
    6
    second
    2
    third
    `
})

app.use(async middleware2(ctx, next) => {
    console.log(3);
    next().then(res => {
        console.log(res);
    });
    console.log(4);
    return "second"
})

app.use(async middleware3(ctx, next) => {
    console.log(5);
    await next(); // Promise.reslove()
    console.log(6);
    return "third"
})

app.listen('3124', () => {
    console.log('run in 3124');
})

```
写在前面：1. 我为使用`app.use`创建的三个中间件起名为`middleware1, middleware2, middleware3`；2. `koa`是没有路由的概念的，不论客户端是通过什么样的路由发来请求，不管客户端是get还是post发来请求，都会运行`middleware1, middleware2, middleware3`三个中间件来处理这个请求
1. `new Koa()`在干什么
    ```js
    constructor(options) {
      // `Koa`是`node`中的事件类的子类
      super();

      // 对当前服务器app，进行一些基础的配置，用户如果有想法可以通过传入options对这些基础配置进行更改
      /** 基础配置开始 */
      // options = {}
      options = options || {};
      // app.proxy = false
      this.proxy = options.proxy || false;
      // app.subdomainOffset = 2
      this.subdomainOffset = options.subdomainOffset || 2;
      // app.proxyIpHeader = "X-Forwarded-For", 这个是http的一个请求或者相应头信息
      this.proxyIpHeader = options.proxyIpHeader || "X-Forwarded-For";
      // app.maxIpsCount = 0
      // 后面的就不一一翻译了
      this.maxIpsCount = options.maxIpsCount || 0;
      // process.env.NODE_ENV，当当前我们写的koa服务器使用webpack或者rollup打包的时候可以配置process.env.NODE_ENV，
      // 表明当前代码打包出来之后是用来开发调试还是上线
      this.env = options.env || process.env.NODE_ENV || "development";
      // compose函数可以用户自己定义，后面会说到这个compose函数
      // 这里简答描述一下，koa提供的compose是用来执行我们自己写的中间件的
      // compose会调度执行我们的中间件，并且返回我们中间件的值，让我们可以通过const nextMiddlewareReturnValue = next()拿到下一个中间件的返回值
      // 有返回值是koa洋葱模型的核心
      this.compose = options.compose || compose;
      // if (options.keys) this.keys = options.keys;
      // 上面这行代码是koa的源代码，但是不够统一，这里统一一下，但是我也注意到了options.keys可能是false，无所谓了就这样写吧
      // 这里还想说一个void 0 === void(0)
      // void()是一个函数，这个()可以不写，这个函数不管调用什么都会返回undefined
      // 使用void 0而不是用undefined的原因是，防止有人把undefined的值给改了，如：undefined = 1
      // void()，js引擎会执行()中的表达式内容，如：void(a = 1), js引擎就会执行a = 1这个表达式
      // void()还有一个使用场景是在<a></a>标签中
      this.keys = options.keys || void 0;
      /** 基础配置结束 */
      
      // 这里用来存放我们写的中间件❕❕❕❕❕
      this.middleware = [];

      // this.context.__proto__ === context
      this.context = Object.create(context);
      this.request = Object.create(request);
      this.response = Object.create(response);

      // util是一个node的内置库
      // util.inspect.custom的值是一个Symbol
      // this.inspect是后面的一个函数function inspect() {return this.toJSON();}
      // util.inspect.custom support for node 6+
      /* istanbul ignore else */
      if (util.inspect.custom) {
        this[util.inspect.custom] = this.inspect;
      }

      // 我们没有在options中传入asyncLocalStorage，那么这里this.ctxStorage的值就是undefined，后面在handleRequest函数里面会用到这个值
      if (options.asyncLocalStorage) {
        const { AsyncLocalStorage } = require("async_hooks");
        assert(
          AsyncLocalStorage,
          "Requires node 12.17.0 or higher to enable asyncLocalStorage"
        );
        this.ctxStorage = new AsyncLocalStorage();
      }
    }
    ```
    `constructor`是`Koa`这个类的构造函数
    `constructor`内部调用了`super`说明`Koa`是一个子类
    从代码中可以看出 对当前服务器app，进行一些基础的配置
    关键点在于，`Koa`创建的服务器中`middleware`数组是空的，也就是说`koa`后面的代码调用`this.middleware.push`的都是我们自己的写的中间件`(middleware1, middleware2, middleware3)`
    不同于`express`, `express`里面会天生存在两个`express`自己提供的中间件，然后才是我们自己写的中间件，后面会提到
    ```js
    const Emitter = require("events");
    class Application extends Emitter
    ```
    `Koa`是`node`中的事件类的子类
    然后`constructor`内部
2. `app.use()`在干什么
    ```js
    use(fn) {
      if (typeof fn !== "function")
        throw new TypeError("middleware must be a function!");
      debug("use %s", fn._name || fn.name || "-");
      // 加入中间件
      this.middleware.push(fn);
      return this;
    }
    ```
    `this`的指向就是`app`，通过`this.middleware.push(fn)`把我们写的中间件`async (ctx, next) => {}`，添加到一个数组中保存起来，且就像我们前面所说的
    保存完毕`this.middleware`中只保存我们写的中间件，不同于`express`, `express`里面会天生存在两个`express`自己提供的中间件
    添加完所有的中间件的结果应该是`[middleware1，middleware2，middleware3]`
3. `app.listen()`在干什么
    ```js
    listen(...args) {
      debug("listen");
      // this.callback()会被执行，然后返回一个函数: (req, res) => {}
      // 这个函数(req, res) => {}的写法是http模块的createServer方法规定的写法
      const server = http.createServer(this.callback());
      return server.listen(...args);
    }
    ```
    执行`this.callback()`
    ```js  
    callback() {
      // function fn(ctx, next) {
      //   内部执行某些逻辑来运行我们写的中间件middleware1，middleware2，middleware3 
      // }
      const fn = this.compose(this.middleware);

      if (!this.listenerCount("error")) this.on("error", this.onerror);

      // 这个就是要传入http.createServer()的函数
      // 这个函数会在每次用户向连接套接字(区别于连接套接字，连接套接字监听连接请求，连接请求到来之后建立请求套接字)发送请求的时候被调用
      const handleRequest = (req, res) => {
        const ctx = this.createContext(req, res);
        if (!this.ctxStorage) {
          return this.handleRequest(ctx, fn);
        }
        return this.ctxStorage.run(ctx, async () => {
          return await this.handleRequest(ctx, fn);
        });
      };

      return handleRequest;
    }
    ```
    首先在`callback`中会调用`compose`函数，并把我们写的中间件组成的数组`[middleware1，middleware2，middleware3]`作为参数传进去
    让我们看看`compose`函数内部对我们的三个中间件做了什么，然后返回什么了
    ```js
    function compose (middleware) {
      // 基本判断，判断传入的是不是数组
      if (!Array.isArray(middleware)) throw new TypeError('Middleware stack must be an array!')
      // 判断数组里面是不是都是函数
      for (const fn of middleware) {
        if (typeof fn !== 'function') throw new TypeError('Middleware must be composed of functions!')
      }
      /**
       * @param {Object} context
       * @return {Promise}
       * @api public
       */
      // 返回一个函数
      return function fnMiddleware(context, next) {
        // last called middleware #
        let index = -1
        return dispatch(0)
        function dispatch (i) {
          if (i <= index) return Promise.reject(new Error('next() called multiple times'))
          index = i
          let fn = middleware[i]
          if (i === middleware.length) fn = next
          if (!fn) return Promise.resolve()
          try {
            return Promise.resolve(fn(context, dispatch.bind(null, i + 1)));
          } catch (err) {
            return Promise.reject(err)
          }
        }
      }
    }
    ```
    `compose`这个函数在执行的时候没有对我们的中间件做任何操作，只是校验了一下中间的是不是函数，然后就返回了一个函数，这里我管返回的这个函数叫作`fnMiddleware`，目的是统一标识符，一会儿就可以看到了，然后`compose`就返回了
    `callback`这个函数使用`fnMiddleware`这个标识符接受这个函数，然后`callback`这个函数返回函数指针`handleRequest`，函数指针`handleRequest`作为参数传入`http.createServer()`中，这个函数会在每次用户向连接套接字(区别于连接套接字，连接套接字监听连接请求，连接请求到来之后建立请求套接字)发送请求的时候被调用
    `callback()`(也就是`this.callback()`)调用完毕返回`handleRequest`之后，`listen()`(也就是`app.listen()`)也会在调用完毕`server.listen(...args)`之后返回`server`这个对象
    仅仅通过看`handleRequest`这个函数是不能看到什么时候以及怎么调用我们创建的中间件的，接下来看当有请求到来的时候会做什么
4. 当有一个请求到来会发生什么
    当有一个请求到来的时候函数`handleRequest`会被执行
    让我们再看看函数`handleRequest`是什么样子的
    ```js
    const handleRequest = (req, res) => {
      // 通过req和res塑造koa的ctx对象
      const ctx = this.createContext(req, res);
      // this.ctxStorage是在new Koa()的时候初始化的一个值
      if (!this.ctxStorage) {
        return this.handleRequest(ctx, fn);
      }
      return this.ctxStorage.run(ctx, async () => {
        return await this.handleRequest(ctx, fn);
      });
    };
    ```
    首先通过使用node的http模块处理好的req和res对象去塑造koa的ctx对象
    createContext函数的代码如下
    ```js
    createContext(req, res) {
      /** @type {Context} */
      // this.context在new Koa()的时候被创建
      // context.__proto__ === this.context
      // this.context.__proto__ === /** 不是这里的context，是new Koa()里面的context */ context
      const context = Object.create(this.context);
      /** @type {KoaRequest} */
      // this.request在new Koa()的时候被创建
      // request.__proto__ === this.request
      // 把requset这个对象挂载到context对象上
      const request = (context.request = Object.create(this.request));
      /** @type {KoaResponse} */
      const response = (context.response = Object.create(this.response));

      // 让当前函数createContext中创建的context，request，respond三个对象上都挂载上app，req，res
      // 注意这里的req和res是http模块对每个客户端的请求建立的原生对象
      context.app = request.app = response.app = this;
      context.req = request.req = response.req = req;
      context.res = request.res = response.res = res;
      // 并且context，request，respond，app四个对象实现相互引用，能方便的相互访问
      request.ctx = response.ctx = context;
      request.response = response;
      response.request = request;

      // 把常用的属性放到context的"一级目录"下面，方便用户访问
      context.originalUrl = request.originalUrl = req.url;
      context.state = {};

      // 返回contexnt对象，这个context对象就是我们平常在中间件中使用的ctx对象
      return context;
    }
    ```
    在函数`createContext`中创建在我们中间件中使用的`ctx`对象`const ctx = this.createContext(req, res);`，`ctx -> context`
    然后判断`this.ctxStorage`是否为`false`，如果是`false`就执行`this.handleRequest`函数
    这个函数内部又做了什么呢
    ```js
    handleRequest(ctx, fnMiddleware) {
      // 参数fnMiddleware就是之前在koa项目启动的时候，compose函数返回的函数fnMiddleware
    
      // ctx.res是node的http模块提供的原生的res
      // 从上面createContext函数中我们可以得知，koa会把http模块提供的res封装成respond供给我们程序员使用
      // 我们可以通过ctx.respond找到这个对象，也可以通过ctx.res找到http模块提供的原生res对象
      const res = ctx.res;
      // 设置响应码为404，后面如果能正常返回再改成200
      res.statusCode = 404;

      // 设置错误处理函数
      const onerror = (err) => ctx.onerror(err);
      const handleResponse = () => respond(ctx);
      onFinished(res, onerror);
      return fnMiddleware(ctx).then(handleResponse).catch(onerror);
    }
    ```
    先是设置基本的响应码，然后创建一些函数
    之后就执行`onFinished`这个函数了
    ```js
    function onFinished (msg, listener) {
      // msg 是 http模块提供的原生的res对象
      // listener是错误处理函数
      if (isFinished(msg) !== false) {
        defer(listener, null, msg)
        return msg
      }

      // attach the listener to the message
      attachListener(msg, wrap(listener))

      return msg
    }
    ```
    注意`onFinished`这个函数参数的名字很奇怪，应该是为了适配其他地方使用这个函数时的语义
    进入`onFinished`这个函数后首先就是执行函数`isFinished`
    ```js
    function isFinished (msg) {
      // msg 是 http模块提供的原生的res对象
      var socket = msg.socket

      if (typeof msg.finished === 'boolean') {
        // 说明是一个服务器向客户端返回的消息❓❓❓❓❓
        // OutgoingMessage
        return Boolean(msg.finished || (socket && !socket.writable))
      }

      if (typeof msg.complete === 'boolean') {
        // 说明是一个客户端发送到服务器的消息❓❓❓❓❓
        // IncomingMessage
        return Boolean(msg.upgrade || !socket || !socket.readable || (msg.complete && !msg.readable))
      }

      // don't know
      return undefined
    }
    ```
    `isFinished`这个函数具体在做什么不太清楚
    这次调用会进入到`typeof msg.finished === 'boolean'`这里面, 最后返回`false`
    `isFinished`返回`false`之后，`onFinished`这个函数内部继续执行函数`wrap(listener)`
    ```js
    function wrap (fn) {
      // fn是在handleRequest中创建的函数const onerror = (err) => ctx.onerror(err);

      var res

      // create anonymous resource
      if (asyncHooks.AsyncResource) {
        res = new asyncHooks.AsyncResource(fn.name || 'bound-anonymous-fn')
      }

      // incompatible node.js
      if (!res || !res.runInAsyncScope) {
        return fn
      }

      // return bound function
      return res.runInAsyncScope.bind(res, fn, null)
    }
    ```
    `asyncHooks`是哪里来的呢？
    这是node基本库提供的一个对象，相当于`var asyncHooks = require('async_hooks')`
    这里做的工作猜测是，如果当前启动服务器的`node`环境(`node`版本)支持`async_hooks`这库，就是用这个库对传入的`fn`, 也就是错误处理函数`const onerror = (err) => ctx.onerror(err);`进行包装，包装成一个异步执行的函数返回；如果不支持`async_hooks`那么就直接返回作为参数传入这个函数的错误处理函数`onerror`
    `wrap`函数的返回值回作为参数被`attachListener`函数使用
    ```js
    function attachListener (msg, listener) {
      // msg 是 http模块提供的原生的res对象
      // listener是异步处理过后的错误处理函数

      // 对于我们第一次从客户端向这个koa服务器发起请求，attached的值是undefined
      var attached = msg.__onFinished

      // create a private single listener with queue
      if (!attached || !attached.queue) {
        attached = msg.__onFinished = createListener(msg)
        attachFinishedListener(msg, attached)
      }

      attached.queue.push(listener)
    }
    ```
    对于我们第一次从客户端向这个`koa`服务器发起请求的时候，`attached`的值是`undefined`
    所以会执行`createListener`这个函数
    ```js
    function createListener (msg) {
      function listener (err) {
        if (msg.__onFinished === listener) msg.__onFinished = null
        if (!listener.queue) return

        var queue = listener.queue
        listener.queue = null

        for (var i = 0; i < queue.length; i++) {
          queue[i](err, msg)
        }
      }

      listener.queue = []

      return listener
    }
    ```
    `createListener`函数内部会创建一个`listener`函数，并在为这个函数对象添加`queue`属性，然后返回这个函数对象`listener`
    这个函数对象返回的时候会被赋值给`attachListener`里面创建的`attached`变量
    然后执行`attachFinishedListener`这个函数
    ```js
    function attachFinishedListener (msg, callback) {
      // msg 是 http模块提供的原生的res对象
      // callback是刚刚createListener返回的listener函数
      
      var eeMsg
      var eeSocket
      var finished = false

      function onFinish (error) {
        eeMsg.cancel()
        eeSocket.cancel()

        finished = true
        callback(error)
      }

      // finished on first message event
      eeMsg = eeSocket = first([[msg, 'end', 'finish']], onFinish)

      function onSocket (socket) {
        // remove listener
        msg.removeListener('socket', onSocket)

        if (finished) return
        if (eeMsg !== eeSocket) return

        // finished on first socket event
        eeSocket = first([[socket, 'error', 'close']], onFinish)
      }

      if (msg.socket) {
        // socket already assigned
        onSocket(msg.socket)
        return
      }

      // wait for socket to be assigned
      msg.on('socket', onSocket)

      if (msg.socket === undefined) {
        // istanbul ignore next: node.js 0.8 patch
        patchAssignSocket(msg, onSocket)
      }
    }
    ```
    进入这个函数首先定义几个变量，定义一个函数
    然后立马执行下一个函数`first`
    ```js
    function first(stuff, done) {
      // stuff是[[msg, 'end', 'finish']]，msg是http模块提供的原生的res对象
      // done是调用first的函数attachFinishedListener中创建的onFinish函数

      if (!Array.isArray(stuff))
        throw new TypeError('arg must be an array of [ee, events...] arrays')

      var cleanups = []

      // 这个传参方式，外层for循环只会执行一次
      for (var i = 0; i < stuff.length; i++) {
        // 外层for循环只会执行一次，这一次时arr为[msg, 'end', 'finish']
        var arr = stuff[i]

        if (!Array.isArray(arr) || arr.length < 2)
          throw new TypeError('each array member must be [ee, events...]')

        // ee === msg === http模块提供的原生的res对象
        var ee = arr[0]

        // 对[msg, 'end', 'finish']这个数组中的后两个值也就是'end', 'finish'进行处理
        for (var j = 1; j < arr.length; j++) {
          var event = arr[j]
          var fn = listener(event, callback)

          // listen to the event
          ee.on(event, fn)
          // push this listener to the list of cleanups
          cleanups.push({
            ee: ee,
            event: event,
            fn: fn,
          })
        }
      }

      function callback() {
        cleanup()
        done.apply(null, arguments)
      }

      function cleanup() {
        var x
        for (var i = 0; i < cleanups.length; i++) {
          x = cleanups[i]
          x.ee.removeListener(x.event, x.fn)
        }
      }

      function thunk(fn) {
        done = fn
      }

      thunk.cancel = cleanup

      return thunk
    }
    ```
    函数`attachFinishedListener`调用`first`函数时，`stuff`是`[[msg, 'end', 'finish']]`，`msg`是`http`模块提供的原生的`res`对象
    这种形式的传递参数导致`first`函数内部的双层`for`循环的外层`for`循环只会执行一次
    内层`for`循环会调用函数`listener`, 在内层`for`循环的第一次执行时的调用方式是`listener('end', 调用first的函数attachFinishedListener中创建的onFinish函数)`
    ```js
    function listener(event, done) {
      return function onevent(arg1) {
        var args = new Array(arguments.length)
        var ee = this
        var err = event === 'error'
          ? arg1
          : null

        // copy args to prevent arguments escaping scope
        for (var i = 0; i < args.length; i++) {
          args[i] = arguments[i]
        }

        done(err, ee, event, args)
      }
    }
    ```
    执行`listener`函数会返回一个函数
    然后`first`函数会让`http`模块提供的原生的`res`对象对`‘end’`这个事件进行监听
    然后first的双层循环的内部`for`循环会执行`j=2`的值，然后再次执行`listener('finish', 调用first的函数attachFinishedListener中创建的onFinish函数)`
    和上面的过程一样，执行`listener函数`会返回一个函数
    然后`first函数`会让http模块提供的原生的`res对象`对`‘finish’`这个事件进行监听
    做完上面这些事儿之后，`first`会在创造一些函数，并把创造的函数`thunk`返回
    执行权重新回到`attachFinishedListener函数`里，这个调用栈有点深，我们把`attachFinishedListener函数`再写一遍
    ```js
    function attachFinishedListener (msg, callback) {
      // msg 是 http模块提供的原生的res对象
      // callback是刚刚createListener返回的listener函数
      
      var eeMsg
      var eeSocket
      var finished = false

      function onFinish (error) {
        eeMsg.cancel()
        eeSocket.cancel()

        finished = true
        callback(error)
      }

      // finished on first message event
      eeMsg = eeSocket = first([[msg, 'end', 'finish']], onFinish)

      // ⭕️⭕️⭕️⭕️⭕️⭕️⭕️
      // 执行到这里了

      function onSocket (socket) {
        // remove listener
        // 先从msg也就是http模块提供的原生的res对象监听的事件中，把‘socket’事件列表里面的onSocket函数去掉，不知道为啥
        msg.removeListener('socket', onSocket)

        if (finished) return
        if (eeMsg !== eeSocket) return

        // finished on first socket event
        eeSocket = first([[socket, 'error', 'close']], onFinish)
      }

      if (msg.socket) {
        // socket already assigned
        onSocket(msg.socket)
        return
      }

      // wait for socket to be assigned
      msg.on('socket', onSocket)

      if (msg.socket === undefined) {
        // istanbul ignore next: node.js 0.8 patch
        patchAssignSocket(msg, onSocket)
      }
    }
    ```
    `first函数`返回的在`first函数`内部创建的`thunk函数`被`attachFinishedListener函数`内部创建的`eeMsg， eeSocket两个对象`"捕获"，注意这时`eeMsg === eeSocket`, 一会儿会用到
    然后创建了一个`onSocket函数`
    之后判读`msg.socket`是不是空，发现不是空
    执行`onSocket(msg.socket)`，`msg`是`http`模块提供的原生的`res对象`
    先从`msg`也就是`http`模块提供的原生的`res对象`监听的事件中，把`‘socket’`从事件列表里面的`onSocket函数`去掉，
    向`req`的`socket对象`上加两个叫`'error'`和`'close'`的事件监听
    然后就`first函数`再次返回`thunk函数`
    之后`onSocket`返回了`undefined`
    然后就回到了`函数attachListener`的调用里面
    ```js
    function attachListener (msg, listener) {
      // listener是异步处理过后的错误处理函数
      var attached = msg.__onFinished

      // create a private single listener with queue
      if (!attached || !attached.queue) {
        attached = msg.__onFinished = createListener(msg)
        attachFinishedListener(msg, attached)
      }

      // ⭕️⭕️⭕️⭕️⭕️⭕️⭕️
      // 执行到这里了
      
      attached.queue.push(listener)
    }
    ```
    还记得吗？
    `createListener函数`内部会创建一个`listener函数`，并在为这个函数对象添加`queue属性`，然后返回这个`函数对象listener`
    `attached`就是这个返回的`函数listener`
    但是在`attachListener函数`内部的`参数listener`是异步处理过后的错误处理函数
    所以`attached.queue.push(listener)`就是把异步处理过后的错误处理函数加到`attached函数`的`queue属性`中
    然后返回到`onFinished函数`中去执行
    ```js
    function onFinished (msg, listener) {
      if (isFinished(msg) !== false) {
        defer(listener, null, msg)
        return msg
      }

      // attach the listener to the message
      attachListener(msg, wrap(listener))

      // ⭕️⭕️⭕️⭕️⭕️⭕️⭕️
      // 执行到这里了
      return msg
    }
    ```
    `onFinished函数`返回处理过后的`http`模块提供的原生的`res对象`
    然后回到`函数handleRequest`中继续执行
    ```js
    handleRequest(ctx, fnMiddleware) {
      // 参数fnMiddleware就是之前在koa项目启动的时候，compose函数返回的函数fnMiddleware，注意fnMiddleware不是我们写的中间件函数！！！
      const res = ctx.res;
      res.statusCode = 404;
      const onerror = (err) => ctx.onerror(err);
      const handleResponse = () => respond(ctx);
      console.log(ctx.onerror);
      onFinished(res, onerror);

      // ⭕️⭕️⭕️⭕️⭕️⭕️⭕️
      // 执行到这里了
      return fnMiddleware(ctx).then(handleResponse).catch(onerror);
    }
    ```
    之后就是把之前构造好的`参数ctx`传入`函数fnMiddleware`中进行执行了
    注意再次强调`fnMiddleware`就是之前在`koa`项目启动的时候，`compose函数`返回的`函数fnMiddleware`❕❕❕❕❕
    到这里为止都没有开始执行我们的中间件`middleware1, middleware2, middleware3`，到目前为止都是在做一些初始化设置，做完这些设置之后，就要开始执行`fnMiddleware函数`然后执行我们的中间件了
    但是在讲解执行`fnMiddleware函数`之前，我们先通过`fnMiddleware(ctx).then(handleResponse).catch(onerror)`对函数fnMiddleware做一个简单的分析
    通过then和catch我们可以相信`fnMiddleware`会返回一个`promise`或者`fnMiddleware`是一个`async`函数，然后在没有错误发生的时候使用`handleResponse`处理，发生错误的时候使用`onerror`处理
    现在让我们进入`fnMiddleware`，看看他是怎么执行我们的中间件的，为什么能实现洋葱模型
    提示：从现在起我们要关注返回值了，这个非常重要
    ```js
    function fnMiddleware(context, next) {
      // 当有一个请求到来的时候，会第一次执行这个fnMiddleware函数，就是我们前面说的fnMiddleware(ctx)
      // 第一次执行fnMiddleware的时候next是undefined

      // last called middleware #
      let index = -1
      return dispatch(0)
      function dispatch (i) {
        if (i <= index) return Promise.reject(new Error('next() called multiple times'))
        index = i
        let fn = middleware[i]
        if (i === middleware.length) fn = next
        if (!fn) return Promise.resolve()
        try {
          return Promise.resolve(fn(context, dispatch.bind(null, i + 1)));
        } catch (err) {
          return Promise.reject(err)
        }
      }
    }
    ```
    首先第一步定义一个`变量index`，值为`-1`，`koa`将使用这个变量作为一个判断条件来遍历`middleware数组`的，`index`用来防止你在一个中间件中调用`next`大于`1`次，`middleware`这个数组是在我们使用`app.listen`时，`koa`内部会执行`compose(this.middleware)`的时候通过参数传入的，`this.middleware`这个数组里面存的就是我们写的三个中间件`middleware1, middleware2, middleware3`
    然后马上就执行`dispatch(0)`，并且返回，`dispatch函数`是什么呢，就写在`fnMiddleware函数`内部
    所以`fnMiddleware函数`的返回值就是`dispatch(0)`的执行结果，`dispatch函数`在参数为`0`的时候的返回值就是`fnMiddleware函数`的返回值，我们可以直观的看到`dispatch函数`的返回值是一个`Promise`, 所以`fnMiddleware函数`的返回值就是一个`Promise`, 和我们之前分析的一致
    现在就让我们开始执行`dispatch(0)`
    ```js
    function dispatch (i) {
      // 现在我们分析的是i = 0的情况

      /**
       * i === 0
       * index === -1
       */
      if (i <= index) return Promise.reject(new Error('next() called multiple times'))

      /**
       * i === 0
       * index === -1
       */
      index = i

      /**
       * i === 0
       * index === 0
       */
      // 取出我们创建的第一个中间件middleware1赋值给fn
      let fn = middleware[i]

      /**
       * i === 0
       * index === 0
       */
      // 我们middleware数组中有三个middleware,[middleware1,middleware2,middleware3]
      // 所以middleware.length就是3
      // i是从0开始去中间件，如果i === 3，那是什么情况呢
      // i === 2的时候上一条let fn = middleware[i]取出的是我们的middleware3
      // 当i === 3的时候，fn会等于undefined
      // 这个时候要把fnMiddleware(context, next)的第二个参数传给fn
      // 但是koa内部调用的时候是在handleRequest函数中通过return fnMiddleware(ctx).then(handleResponse).catch(onerror)方式调用的fnMiddleware函数，这个next永远是undefined
      // 注意这里的next不是我们在中间件中调用的next
      // 我们在中间件中调用next的的时候是为了调用下一个中间件对吧，下一个中间件肯定要从middleware中去取啊
      // 我们在中间件中调用的next肯定是koa通过某种方式在执行上一个中间件的时候作为参数给我们传递进来的，类似于fn[n-1](ctx，fn[n])这种
      // 怎么执行上一个中间件以及如何把下一个中间件作为参数传递到下一个中间件我们马上就能看到
      // 但是一定要记住，在dispatch中的变量next一定是undefined，不是我们在中间件中用的next
      if (i === middleware.length) fn = next

      /**
       * i === 0
       * index === 0
       */
      // 如果fn没有取到值，就是没有中间件要执行了，就返回一个fulfill的Promise
      if (!fn) return Promise.resolve()

      try {
      /**
       * i === 0
       * index === 0
       */
        // 重点来了，看看koa怎么把下一个中间件作为参数传递进去到上一个中间中去执行
        // 首先看fn(context, dispatch.bind(null, i + 1))
        // 这次是在执行dispatch(0)的过程中执行的，所以我们还能简化并明确一下各个参数的值
        // middleware1(ctx, dispatch.bind(null, 1))
        // koa是通过dispatch.bind(null, n + 1)的方式把下一个中间作为参数传递到上一个中间件中去的
        // 注意.bind只会绑定参数，而不会立即执行，所以下面会执行的是middleware1这个函数，这个中间件，而不是执行dispatch.bind(null, n + 1)这个函数
        // fn(context, dispatch.bind(null, i + 1))执行完，就是middleware1(ctx, dispatch.bind(null, 1))执行完，会返回我们中间件middleware1中的返回值，而不是next的返回值，这里很容易弄乱
        return Promise.resolve(fn(context, dispatch.bind(null, i + 1)));
      } catch (err) {
        return Promise.reject(err)
      }
    }
    ```
    从注释中我们讲到了执行middleware1
    ```js
    async middleware1(ctx, next) => {
        // next 就是 dispatch.bind(null, 1)

        console.log(1);

        // next()等于是执行dispatch.bind(null, 1)()
        const a = await next();
        console.log(a);
        console.log(2);
        ctx.body = `
        打印
        1
        3
        5
        4
        6
        second
        2
        third
        `
    }
    ```
    先在服务端打印1，然后执行`next`了，就是在执行`dispatch.bind(null, 1)()`
    ```js
    function dispatch (i) {
      // 现在我们分析的是i = 1的情况
      // 上一次的dispatch(0)，已经把index的值改为了0

      /**
       * i === 1
       * index === 0
       */
      if (i <= index) return Promise.reject(new Error('next() called multiple times'))

      /**
       * i === 1
       * index === 0
       */
      index = i

      /**
       * i === 1
       * index === 1
       */
      // 取出我们创建的第二个中间件middleware2赋值给fn
      let fn = middleware[i]

      /**
       * i === 1
       * index === 1
       */
      if (i === middleware.length) fn = next

      /**
       * i === 1
       * index === 1
       */
      if (!fn) return Promise.resolve()

      try {
      /**
       * i === 1
       * index === 1
       */
        // middleware2(ctx, dispatch.bind(null, 2))
        // 从在我们的middleware1中调用next开始一直到这了才开始执行第二个中间件middleware2
        // 我们可以看到虽然之前在middleware1(ctx, dispatch.bind(null, 1))执行的时候，koa传入的参数不是middleware2
        // 但是koa会使用i这个参数来取出middleware2，然后在这里执行
        return Promise.resolve(fn(context, dispatch.bind(null, i + 1)));
      } catch (err) {
        return Promise.reject(err)
      }
    }
    ```
    下面我们要执行`middleware2`了
    ```js
    async middleware2(ctx, next) => {
        // next 就是 dispatch.bind(null, 2)

        console.log(3);

        // next()等于是执行dispatch.bind(null, 2)()
        next().then(res => {
            console.log(res);
        });
        console.log(4);
        return "second"
    }
    ```
    打印3，然后执行`next()`，就是在执行`dispatch.bind(null, 2)()`
    ```js
    function dispatch (i) {
      // 现在我们分析的是i = 2的情况
      // 上一次的dispatch(1)，已经把index的值改为了1

      /**
       * i === 2
       * index === 1
       */
      if (i <= index) return Promise.reject(new Error('next() called multiple times'))

      /**
       * i === 2
       * index === 1
       */
      index = i

      /**
       * i === 2
       * index === 2
       */
      // 取出我们创建的第三个中间件middleware3赋值给fn
      let fn = middleware[i]

      /**
       * i === 2
       * index === 2
       */
      if (i === middleware.length) fn = next

      /**
       * i === 2
       * index === 2
       */
      if (!fn) return Promise.resolve()

      try {
      /**
       * i === 2
       * index === 2
       */
        // middleware3(ctx, dispatch.bind(null, 3))
        // 从在我们的middleware2中调用next开始一直到这了才开始执行第三个中间件middleware3
        // 我们可以看到虽然之前在middleware1(ctx, dispatch.bind(null, 3))执行的时候，koa传入的参数不是middleware3
        // 但是koa会使用i这个参数来取出middleware3，然后在这里执行
        return Promise.resolve(fn(context, dispatch.bind(null, i + 1)));
      } catch (err) {
        return Promise.reject(err)
      }
    }
    ```
    下面我们要执行middleware3了
    ```js
    async middleware3(ctx, next) => {
        // next 就是 dispatch.bind(null, 3)

        console.log(5);

        // next()等于是执行dispatch.bind(null, 3)()
        await next(); // Promise.reslove()
        console.log(6);
        return "third"
    }
    ```
    打印5，然后执行`next()`，就是在执行`dispatch.bind(null, 3)()`
    ```js
    function dispatch (i) {
      // 现在我们分析的是i = 3的情况
      // 上一次的dispatch(2)，已经把index的值改为了2

      /**
       * i === 3
       * index === 2
       */
      if (i <= index) return Promise.reject(new Error('next() called multiple times'))

      /**
       * i === 3
       * index === 2
       */
      index = i

      /**
       * i === 3
       * index === 3
       */
      // 这次取到的fn就是undefined了
      let fn = middleware[i]

      /**
       * i === 3
       * index === 3
       */
      // 这个判断在这次通过了，fn = next被执行，但是fn还是undefined
      // 因为koa内部调用的时候是在handleRequest函数中通过return fnMiddleware(ctx).then(handleResponse).catch(onerror)方式调用的fnMiddleware函数，这个next永远是undefined
      if (i === middleware.length) fn = next

      /**
       * i === 3
       * index === 3
       */
      // 这个判断在这次通过了，直接返回Promise.resolve()
      // 洋葱模型要开始了❕❕❕❕❕
      if (!fn) return Promise.resolve()

      // 后面不会执行了！！！
      try {
        return Promise.resolve(fn(context, dispatch.bind(null, i + 1)));
      } catch (err) {
        return Promise.reject(err)
      }
    }
    ```
    从`dispatch函数`开始返回`Promise.resolve()`的时候洋葱模型就开始了
    首先我们卖个关子，我在这里放一张现在的调用栈的图片，便于观察每个函数返回时都是返回到哪里了
    ![一次请求到来，形成的最深的调用栈](./README_img/koa中间件.drawio.png)
    ❕❕❕❕❕`dispatch`返回会返回到哪里？
    ❕❕❕❕❕这个问题非常关键
    看看我们的执行过程，就知道了，这个函数返回不是返回到上一个`dispatch`
    比如我们现在调用的不是`dispatch(3)`嘛，他返回不是返回到`dispatch(2)`, 这一点非常关键❕❕❕❕❕，不要乱
    `dispatch(3)`返回是返回到我们的第三个中间件`middleware3`中`next()`执行的位置
    ```js
    async middleware3(ctx, next) => {
        console.log(5);

        // dispatch(3)返回就是next()返回了
        await /** ⭕️⭕️⭕️⭕️⭕️⭕️⭕️ 执行到这里了 */ next(); 
        console.log(6);
        return "third"
    }
    ```
    这样的结果不直观我们再写的更直观一点
    ```js
    async middleware3(ctx, next) => {
        console.log(5);

        // dispatch(3)返回就是next()返回了
        await /** ⭕️⭕️⭕️⭕️⭕️⭕️⭕️ 执行到这里了 */ Promise.resoled(); 
        console.log(6);
        return "third"
    }
    ```
    现在遇到了`await`了，`await`会干什么，这个也很关键，这个是大家经常搞乱`koa`怎么实现洋葱模型的关键
    `await`是什么的变形，再说清楚点，`async-await`是什么的语法糖？
    是`Promise和generate`的语法糖！！！
    `await`对标的是`generate`里面的什么？
    `await`对标的是`generate里面的yeild`
    在一个`generate函数`执行遇到`yeild`的时候会干什么？
    这个`generator函数`会返回，返回值是什么，是`yeild`后面跟的值
    那对于`await`来说呢，当一个函数执行到`await`的时候`await`也会返回，返回值和`yeild`是不同的，`await`永远会放回一个`pending状态的Promise`，这么说可能不太好理解，我们把`await`会返回的东西写一下
    ```js
    async middleware3(ctx, next) => {
        console.log(5);

        // dispatch(3)返回就是next()返回了
        return Promise.resoled() /** 这个是要返回的东西 */.then(res => {
          console.log(6);
          return "third"
        }
    }
    ```
    上面这段代码中由于`.then中的回调函数`还没有被执行(因为`Promise.resoled()`虽然是`fulfill`的，会把`.then中的回调函数`放入到微任务队列中，但是这个回调函数还没有被执行)，由于`.then中的回调函数`还没有被执行，所以`.then创建的Promise`是`pending状态`的。这里有个小问题，如果`next函数`返回的不是`promise对象`怎么办？一会儿我们解答
    那什么时候`generate函数`继续执行呢？在`generate函数`的`generator`调用`next`的时候继续执行，然后把`next`里面传入的参数传递到`generate`里面去(比如`const res = yeild 1`，`next`中传入的值会被`res`接受)
    那么`await`什么时候把值传回来让`middleware3`继续执行呢？在`await`后面直接跟随的`Promise`(在这里就是`dispatch(3)`返回的`Promise.resolve()`)变成`fulfilled`之后并且这个`fulfilled`的`Promise`在微任务队列里面被执行的时候，作为await之后的代码就继续执行了(比如`const res = await Promise.resolve(1)`，当`Promise.resolve(1)`在微任务队列中就绪的时候，`1`就会给到`res`，然后代码继续执行)
    这里就引出了一个问题，也是刚刚想说的小问题如果await后面跟的不是`Promise`不就不能使用上面的规范了嘛？
    没关系，`await`会判断后面的值是否是`Promise`，如果不是就使用`Promise.resolve()`包装一下
    前面做了这么多解释，接下来就要继续执行代码了
    `await`会直接让`middleware3`这个函数返回，返回值是一个`pending的Promise`，就是我们刚刚说的`.then创建的promise`
    在`await`返回的同时，由于有一个`pending状态的Promise`产生了————就是`next()`返回的`<pending> Promise`同时也是`dispatch(3)`返回的`<pending> Promise`，微任务队列会加上一个微任务`(mircoTasks:\[middleware3继续从await返回执行\])`，并且在执行微任务的时候会导致返回到`middleware3`继续执行
    注意区分：`middleware3`通过`await`返回的是一个`.then创建的pending状态的Promise对象`，由于`Promise.resolve()`的执行，会向微任务队列中添加`.then里面的回调函数`，是这样的一个关系。把`await`后面的代码改造成一个`.then包裹的回调函数`，然后把这个`.then函数创建的Promise`返回，这些都是`await`这个关键字的作用；然而把`.then里面的回调`放入微任务队列的原因是`Promise.resolve()`是一个`fulfilled状态的promise`
    现在我们再说网上大部分帖子搞乱的是什么————他们都说因为`koa`在调用中间件的代码中`return Promise.resolve(fn(context, dispatch.bind(null, i + 1)));` 返回了`Promise.resolve()`包装的值，所以能实现洋葱模型，这样的话就会让人产生误解————"`koa`是因为调用中间件之后对中间件的返回值进行了`Promise.resolve()`包装才实现了洋葱模型"，其实不是的，难道`express`不支持洋葱模型的原因是`express`调用中间件之后，对中间件的返回值没有使用`Promise.resolve()`进行包装吗？不是的！`express`没能实现洋葱模型的原因是`express`调用中间件之后没有返回中间件的返回值！！！`koa`使用`Promise.resolve()`对返回值进行包裹的原因是————对于`node`版本较低的时候，`node`是不支持`async-await`的，这个时候`koa`可以使用`next().then()`的方式实现`async-await`的效果，但是现在的`node`中支持了`async-await`，`async`和`await`都会对后面跟着的`非Promise值`使用`Promise.resolve()`包装，所以现在就算`koa`在返回"中间件调用的返回值"时不使用`Promise.resolve()`包装也是可以实现洋葱模型的，就是改成`return fn(context, dispatch.bind(null, i + 1));` 也是可以支持洋葱模型的，同理只要`express`会把中间件调用的结果返回到上一个`next()`, 那么`express`也是能实现洋葱模型的！！！后面我们会基于这个想法对`express`进行改造，使其实现洋葱模型，改造过程可以说是非常简单
    `middleware3`返回会返回到哪个函数呢？就是`middleware`3这个函数在函数调用栈中的上一个函数是什么？那个函数调用的`middleware3`这个函数？
    是`fn(ctx, dipatch.bind(null, 2))`
    ```js
    function dispatch (i) {
      // 现在我们分析的是i = 2的情况
      // 上一次的dispatch(1)，已经把index的值改为了1

      if (i <= index) return Promise.reject(new Error('next() called multiple times'))
      index = i
      let fn = middleware[i]
      if (i === middleware.length) fn = next
      if (!fn) return Promise.resolve()

      try {
      /**
       * i === 2
       * index === 2
       */
        return Promise.resolve( /** ⭕️⭕️⭕️⭕️⭕️⭕️⭕️ 执行到这里了 */ fn(context, dispatch.bind(null, i + 1)));
      } catch (err) {
        return Promise.reject(err)
      }
    }
    ```
    `fn(context, dispatch.bind(null, i + 1))`返回，返回值就是刚刚说的`middleware3`内部执行到`await`时的返回值，`一个pending状态的Promise`
    然后`dispatch(2)`就要返回了，返回值是`Promise.resolve(<pending> Promise)`, 由于`Promise.resolve()`具有幂等性，所以相当于是返回了`<pending> Promise`
    这里不需要向微任务队列中添加微任务，原因是这个`Promise.resolve(fn(context, dispatch.bind(null, i + 1)))`没有调用`.then`并且在前面也没有`await`
    这里补充一下，加入微任务队列的不是`Promise对象`，而是`Promise对象`后面的`.then`的任务，当一个`Promise`就绪的时候会把`.then里面的任务`加入到微任务队列中
    注：有的时候会把一个`Promise`的执行过程加入到微任务队列中，这个是`V8`做的事情，有一道经典的面试题是这个过程
    `dispatch(2)`要返回`<pending> Promise`到哪里呢？其实就是在问哪里调用的`dispatch(2)`？
    是在我们的中间件`middleware2`中，调用`next()`的时候调用的`dispatch(2)`，所以要把`<pending> Promise`作为`middleware2`中`next()的返回值`
    ```js
    async middleware2(ctx, next) => {
        // next 就是 dispatch.bind(null, 2)

        console.log(3);

        // next()等于是执行dispatch.bind(null, 2)()
        next()/** ⭕️⭕️⭕️⭕️⭕️⭕️⭕️ 执行到这里了 */.then(res => {
            console.log(res);
        });
        console.log(4);
        return "second"
    }
    ```
    还是改写一下，让结果变得更清楚
    ```js
    async middleware2(ctx, next) => {
        // next 就是 dispatch.bind(null, 2)

        console.log(3);

        // next()等于是执行dispatch.bind(null, 2)()
        "<pending> Promise"/** ⭕️⭕️⭕️⭕️⭕️⭕️⭕️ 执行到这里了 */.then(res => {
            console.log(res);
        });
        console.log(4);
        return "second"
    }
    ```
    这里调用了`.then`，会发生什么？
    就像我们前面说的，调用了`.then`，就会等调用`.then`的那个`Promise在状态变成fulfilled`的时候把`.then中的回调函数`加入到微任务队列中
    由于`<pending> Promise不是fulfilled状态的`，所以微任务队列不会加微任务
    然后就继续执行`middleware2的next()`之后的内容了
    打印`4`，返回`"second"`这个字符串，注意这里返回的是字符串
    但是这是个`async函数`，`async函数`在返回返回值的时候会做和`await`相同的处理，会把不是`Promise的返回值`包装一下！！！！！所以这里真实的返回值是`Promise.resolve("second")`
    `middleware2`返回了会返回到哪里呢？还是这个老生常谈的问题
    会返回到`fn(ctx, dispacth(null, 1))`
    ```js
    async middleware1(ctx, next) => {
        // next 就是 dispatch.bind(null, 1)

        console.log(1);

        // next()等于是执行dispatch.bind(null, 1)()
        const a = await next();
        console.log(a);
        console.log(2);
        ctx.body = `
        打印
        1
        3
        5
        4
        6
        second
        2
        third
        `
    }
    ```
    先在服务端打印`1`，然后执行`next`了，就是在执行`dispatch.bind(null, 1)()`
    ```js
    function dispatch (i) {
      // 现在我们分析的是i = 1的情况
      // 上一次的dispatch(0)，已经把index的值改为了0

      if (i <= index) return Promise.reject(new Error('next() called multiple times'))
      index = i
      let fn = middleware[i]
      if (i === middleware.length) fn = next
      if (!fn) return Promise.resolve()

      try {
      /**
       * i === 1
       * index === 1
       */
        return Promise.resolve( /** ⭕️⭕️⭕️⭕️⭕️⭕️⭕️ 执行到这里了 */ fn(context, dispatch.bind(null, i + 1)));
      } catch (err) {
        return Promise.reject(err)
      }
    }
    ```
    `fn(context, dispatch.bind(null, i + 1))`要返回了，返回值就是刚刚说的`middleware2的返回值`(注意这里不是通过`await`返回的，是`middleware2`通过`return`返回的)`Promise.resolve("second")`
    然后`dispatch(1)`就要返回了，返回值是`Promise.resolve(Promise.resolve("second"))`, 由于`Promise.resolve()`具有幂等性，所以相当于是返回了`Promise.resolve("second")`
    这里不需要向微任务队列中添加微任务，原因是这个`Promise.resolve(fn(context, dispatch.bind(null, i + 1)))`没有调用`.then`并且在前面也没有`await`
    `dispatch(1)`要返回`Promise.resolve("second")`到哪里呢？其实就是在问哪里调用的`dispatch(1)`？
    是在我们的`中间件middleware1`中，调用`next()`的时候调用的`dispatch(1)`，所以要把`Promise.resolve("second")`作为`middleware1中next()的返回值`
    ```js
    async middleware1(ctx, next) => {
        // next 就是 dispatch.bind(null, 1)

        console.log(1);

        // next()等于是执行dispatch.bind(null, 1)()
        const a = await /** ⭕️⭕️⭕️⭕️⭕️⭕️⭕️ 执行到这里了 */ next();
        console.log(a);
        console.log(2);
        ctx.body = `
        打印
        1
        3
        5
        4
        6
        second
        2
        third
        `
    }
    ```
    还是在做个调整
    ```js
    async middleware1(ctx, next) => {
        // next 就是 dispatch.bind(null, 1)

        console.log(1);

        // next()等于是执行dispatch.bind(null, 1)()
        const a = await /** ⭕️⭕️⭕️⭕️⭕️⭕️⭕️ 执行到这里了 */ Promise.resolve("second");
        console.log(a);
        console.log(2);
        ctx.body = `
        打印
        1
        3
        5
        4
        6
        second
        2
        third
        `
    }
    ```
    `await`会直接让`middleware1这个函数`返回，返回值又是一个由`.then创建的pending状态的Promise`，什么样子呢？我们再写一下
    ```js
    async middleware1(ctx, next) => {
        // next 就是 dispatch.bind(null, 1)

        console.log(1);

        // next()等于是执行dispatch.bind(null, 1)()
        return Promise.resolve("second") /** 这后面就是要返回的Promise对象 */.then(a => {
          console.log(a);
          console.log(2)
          ctx.body = `
          打印
          1
          3
          5
          4
          6
          second
          2
          third
          `
        })
    }
    ```
    `await`返回这个`pending的Promise`的同时，由于有一个`fulfilled状态的Promise`产生了，微任务队列会加上一个微任务`(mircoTasks:\[middleware3继续从await返回执行，middleware1继续从await返回执行\])`，并且在执行微任务的时候会导致返回到`middleware1`的上下文中继续执行
    然后`middleware1`就要返回了，`middleware1`返回会返回到哪个函数呢？就是`middleware1这个函数`在函数调用栈中的上一个函数是什么？那个函数调用的`middleware1这个函数`？
    是`dispatch(0)`
    ```js
        function dispatch (i) {
      // 现在我们分析的是i = 0的情况

      if (i <= index) return Promise.reject(new Error('next() called multiple times'))
      index = i
      let fn = middleware[i]
      if (i === middleware.length) fn = next
      if (!fn) return Promise.resolve()

      try {
      /**
       * i === 0
       * index === 0
       */
        return Promise.resolve( /** ⭕️⭕️⭕️⭕️⭕️⭕️⭕️ 执行到这里了 */ fn(context, dispatch.bind(null, i + 1)));
      } catch (err) {
        return Promise.reject(err)
      }
    }
    ```
    `fn(context, dispatch.bind(null, i + 1))`要返回了，返回值就是刚刚说的`middleware1的返回值`(注意这里不是通过`await`返回的，是`middleware1通过return返回的`)`<pending> Promise`
    然后`dispatch(0)`就要返回了，返回值是`Promise.resolve(<pending> Promise)`, 由于`Promise.resolve()`具有幂等性，所以相当于是返回了`<pending> Promise`
    这里不需要向微任务队列中添加微任务，原因是这个`Promise.resolve(fn(context, dispatch.bind(null, i + 1)))`没有调用`.then`并且在前面也没有`await`
    `dispatch(0)`要返回`<pending> Promise`到哪里呢？其实就是在问哪里调用的`dispatch(0)`？
    是在`koa`的`fnMiddleware函数`，终于出来了，`fnMiddleware`这个函数是什么来着？
    ```js
    function fnMiddleware(context, next) {
      // 当有一个请求到来的时候，会第一次执行这个fnMiddleware函数，就是我们前面说的fnMiddleware(ctx)
      // 第一次执行fnMiddleware的时候next是undefined

      // last called middleware #
      let index = -1
      return /** ⭕️⭕️⭕️⭕️⭕️⭕️⭕️ 执行到这里了 */ dispatch(0)
      function dispatch (i) {
        if (i <= index) return Promise.reject(new Error('next() called multiple times'))
        index = i
        let fn = middleware[i]
        if (i === middleware.length) fn = next
        if (!fn) return Promise.resolve()
        try {
          return Promise.resolve(fn(context, dispatch.bind(null, i + 1)));
        } catch (err) {
          return Promise.reject(err)
        }
      }
    }
    ```
    `fnMiddleware`直接返回了`dispatch(0)`，所以`fnMiddleware的返回值`是`<pending> Promise`
   ` 函数fnMiddleware`会返回到哪里呢？是`handleRequest`
    ```js
    handleRequest(ctx, fnMiddleware) {
      const res = ctx.res;
      res.statusCode = 404;
      const onerror = (err) => ctx.onerror(err);
      const handleResponse = () => respond(ctx);
      console.log(ctx.onerror);
      onFinished(res, onerror);
      return fnMiddleware(ctx) /** ⭕️⭕️⭕️⭕️⭕️⭕️⭕️ 执行到这里了 */ .then(handleResponse).catch(onerror);
    }
    ```
    这里调用了`.then`，会发生什么？
    就像我们前面说的，调用了`.then`，就会等`调用.then的那个Promise`在`状态变成fulfilled`的时候把`.then中的回调函数`加入到微任务队列中
    由于`fnMiddleware`返回的`<pending> Promise`就`不是fulfilled状态的`，所以微任务队列会不加上微任务
    然后`handleRequest`也要返回了，返回什么呢？
    这是就要说到`.then()`会返回什么的问题了
    `.then()的返回值`是`.then里面函数的返回值`，如果`.then里面的函数`返回的`不是Promise`，同样会用`Promise.resolve()`包裹一下，在返回出来
    但是现在`.then里面的函数`没有执行，怎么知道返回值呢？
    那么返回值就是`pending状态的Promise`
    然后`handleRequest`就要`返回pending状态的Promise`了，返回到哪里呢？
    ```js
    const handleRequest = (req, res) => {
      const ctx = this.createContext(req, res);
      if (!this.ctxStorage) {
        return /** ⭕️⭕️⭕️⭕️⭕️⭕️⭕️ 执行到这里了 */ this.handleRequest(ctx, fn);
      }
      return this.ctxStorage.run(ctx, async () => {
        return await this.handleRequest(ctx, fn);
      });
    };
    ```
    首先`handleRequest(ctx, fn)`返回一个`pending状态的Promise`，然后`return pending状态的Promise`就会直接把这个`Promise对象`返回了，返回到哪里呢？
    这里补充一下，不管是什么状态的`Promise`，他们==都不是状态==，而是`Promise对象`，任何的状态都是`Promise的属性`，状态是依附于`Promise这个对象`存在的
    ```js
    listen(...args) {
      debug("listen");
      const server = http.createServer(this.callback());
      return server.listen(...args);
    }
    ```
    这里就是`node`的`http模块`在接受到一个请求之后，执行执行`handleRequest = (req, res) => {}`回调函数的地方了
    然后`node`就会发现时间循环中`handleRequest = (req, res) => {}`这个回调函数已经执行完毕了，该去执行微任务队列中的内容了
    微任务队列现在是什么样子的呢？`mircoTasks:\[middleware3继续从await返回执行，middleware1继续从await返回执行\]`
    所以会先回到`middleware3`，从`middleware3的await`后面继续执行，其实就是执行`await`创建的`.then中的回调函数`
    ```js
    async middleware3(ctx, next) => {
        console.log(5);

        // dispatch(3)返回就是next()返回了
        await Promise.resoled(); 
        /** ⭕️⭕️⭕️⭕️⭕️⭕️⭕️ 执行到这里了 */
        console.log(6);
        return "third"
    }
    async middleware3(ctx, next) => {
        console.log(5);

        // dispatch(3)返回就是next()返回了
        return Promise.resoled().then(res => {
           /** ⭕️⭕️⭕️⭕️⭕️⭕️⭕️ 执行到这里了 */
          console.log(6);
          return "third"
        })
    }
    ```
    之后就是打印`6`，然后返回`"third"`。`.then`里面的函数会把`不是Promise的返回值`包装用`Promise.resolve()`一下，然后返回。
    当`.then里面的函数`返回`"third"`的时候，这个时候就会注意到这个`.then创建的Promise`的`状态从pending转变成fulfilled`了！！！
    大家还记得这个`.then创建的promise`在哪里被调用`.then`了吗？是在`middleware2`中，下面是`middleware2`
    ```js
    async middleware2(ctx, next) => {
        // next 就是 dispatch.bind(null, 2)

        console.log(3);

        // next()等于是执行dispatch.bind(null, 2)()
        "<pending> Promise".then(res => {
            console.log(res);
        });
        console.log(4);
        return "second"
    }
    ```
    由于这个`<pending> Promise`变成了`<fulfilled> Promise`了，我们也通过一些改写，来让这个函数现在的内部上下文变得更清晰
    ```js
    async middleware2(ctx, next) => {
        // next 就是 dispatch.bind(null, 2)

        console.log(3);

        // next()等于是执行dispatch.bind(null, 2)()
        Promise.resolve("third").then(res => {
            console.log(res);
        });
        console.log(4);
        return "second"
    }
    ```
    所以这个`Promise.resolve("third")`后面的`.then里面的回调`就会被加入到微任务队列中，这时微任务队列会加入一个新任务 `mircoTasks:\[middleware1继续从await返回执行，middleware2中的.then中的回调函数\]`
    之后继续执行微任务队列中的下一个微任务，就是继续执行`middleware1`
    这里要解释一下：`middleware2`中的`"<pending> Promise".then(res => {console.log(res);});`的后面没有再调用`.then`，所以不用再关注这个`"<pending> Promise".then`的状态变化了
    ```js
    async middleware1(ctx, next) => {
        // next 就是 dispatch.bind(null, 1)

        console.log(1);

        // next()等于是执行dispatch.bind(null, 1)()
        const a /** ⭕️⭕️⭕️⭕️⭕️⭕️⭕️ 执行到这里了 */ = await Promise.resolve("second");
        console.log(a);
        console.log(2);
        ctx.body = `
        打印
        1
        3
        5
        4
        6
        second
        2
        third
        `
    }
    async middleware1(ctx, next) => {
        // next 就是 dispatch.bind(null, 1)

        console.log(1);

        // next()等于是执行dispatch.bind(null, 1)()
        return Promise.resolve("second").then(a => {
          /** ⭕️⭕️⭕️⭕️⭕️⭕️⭕️ 执行到这里了 */
          console.log(a);
          console.log(2)
          ctx.body = `
          打印
          1
          3
          5
          4
          6
          second
          2
          third
          `
        })
    }
    ```
    之后就是打印`"second"`，然后再打印`2`, 之后设置`ctx.body`的值用于后续的网络消息返回，返回`Promise.resolve(undefined)`
    这时还是由于这个`<pending> Promise`变成了`<fulfilled> Promise`了，所以这个`Promise`后面的`.then里面的回调`就会被加入到微任务队列中，这时微任务队列会加入一个新任务 `mircoTasks:\[middleware2中的.then中的回调函数，执行handleRequest函数中的handleResponse函数\]`，在执行微任务的时候会导致返回到`handleRequest函数`上下文中继续执行
    之后继续执行微任务队列中的下一个微任务，就是继续执行`middleware2`
    在继续执行middleware2之前我们要说一个东西，那就是在"设置`ctx.body`的值用于后续的网络消息返回和返回`Promise.resolve(undefined)`"之前还有一件事请发生，在设置ctx的值的时候会触发ctx上的属性监听器，这个东西就是vue中使用的setter
    我们先看看触发setter之后会做什么再回到middleware2
    ```js
    // 下面的Delegator.prototype.setter函数是koa在初始化的时候为ctx对象上的属性添加监听器时使用的函数，这个函数为某个属性绑定setter函数
    Delegator.prototype.setter = function(name){
      var proto = this.proto;
      var target = this.target;
      this.setters.push(name);

      // 通过这个函数真正的绑定setter函数
      // node中为对象的某个属性设置setter的方式
      proto.__defineSetter__(name, 
      
      // 真正的setter函数
      // 这个才是为属性绑定上的setter函数
      function(val){
        /** ⭕️⭕️⭕️⭕️⭕️⭕️⭕️ 设置ctx.body的时候会从这里开始只执行 */

        /** 
         * target === 'response'
         * name === 'body'
         */
        return this[target][name] = val;
      });

      return this;
    };
    ```
    从代码里可以看出为ctx对象的body属性赋值会触发setter函数，这个setter函数里面会为response对象的body属性赋值，然后就会触发response对象上body属性的setter，所以本质上我们在我们的源代码中对ctx.body赋值其实是在对response.body属性赋值, 现在就让我们看看触发response.body属性的setter会触发什么吧
    ```js
    set body (val) {
      // 猜测this._body才是最后返回给用户的响应体存储的地方
      const original = this._body
      this._body = val

      // 如果我们ctx.body = null或者ctx.body = undefined的时候会进入下面的if执行体中
      // no content
      if (val == null) {
        if (!statuses.empty[this.status]) {
          if (this.type === 'application/json') {
            this._body = 'null'
            return
          }
          this.status = 204
        }
        if (val === null) this._explicitNullBody = true
        this.remove('Content-Type')
        this.remove('Content-Length')
        this.remove('Transfer-Encoding')
        return
      }
      
      // this._explicitStatus === undefined，this._explicitStatus这个属性是用来判断有没有设置过响应码的，马上就能看到
      // set the status 设置状态码
      // 会触发response.status的setter
      if (!this._explicitStatus) this.status = 200

      // set the content-type only if not yet set
      const setType = !this.has('Content-Type')

      // string
      if (typeof val === 'string') {
        if (setType) this.type = /^\s*</.test(val) ? 'html' : 'text'
        this.length = Buffer.byteLength(val)
        return
      }

      // buffer
      if (Buffer.isBuffer(val)) {
        if (setType) this.type = 'bin'
        this.length = val.length
        return
      }

      // stream
      if (val instanceof Stream) {
        onFinish(this.res, destroy.bind(null, val))
        if (original !== val) {
          val.once('error', err => this.ctx.onerror(err))
          // overwriting
          if (original != null) this.remove('Content-Length')
        }

        if (setType) this.type = 'bin'
        return
      }

      // json
      this.remove('Content-Length')
      this.type = 'json'
    },
    ```
    在执行到this.status = 200的时候会触发response.status的setter函数
    ```js
    set status (code) {
      // this.headerSent为false
      if (this.headerSent) return

      // 经过两个对状态码的断言，要求状态码不能是非数字且必须在100～999之间
      assert(Number.isInteger(code), 'status code must be a number')
      assert(code >= 100 && code <= 999, `invalid status code: ${code}`)

      // 还记得这个this._explicitStatus吗
      // 在response.body的setter中使用到了这个值
      // this._explicitStatus = true标识已经明确的设置了状态码了
      // 也就是说在response.body的setter中会判断用户是否手动的对response.status进行了赋值，如果用户手动的赋值了
      // response.body的setter函数中就不会再对response.status进行赋值了
      this._explicitStatus = true

      // res是node的http模块提供的原生的响应对象，一会儿向用户响应内容的时候真正用的是res这个对象，
      // 真正向用户返回内容的能力是node的http模块提供的！！！
      // 不管koa做了什么样的封装，使用了什么中间对象(如: ctx, request, response)，最后还是要由koa操作http模块提供的res对象来向用户响应内容
      // 这个res是哪来的？在每个请求到来时http模块都会调用handleRequest = (req, res)这个回调函数，http模块在调用的回调函数的时候会传入这个原生的res
      this.res.statusCode = 
      // this.req.httpVersionMajor标识当前服务器与客户端通信使用的http协议的主版本
      // 这里的我们的客户端和服务器之间使用的是http1.1(因为koa默认使用的node的http模块就是1.1的)，有其他的库可以配合koa把koa升级到使用http2.0或者http3.0的模块
      // 因为用http是1.1的所以this.req.httpVersionMajor === 1
      if (this.req.httpVersionMajor < 2) this.res.statusMessage = statuses[code]
      // 调用this.body的时候就是在调用response.body，所以会触发response.body的getter，这个getter用注释的方式展示
      /**
       *   get body () {
       *    return this._body
       *   },
       */
      // 这里的this._body是不是很眼熟？
      // 在response.body的setter函数里面对这个this._body赋过值！！！
      if (this.body && statuses.empty[code]) this.body = null
    },
    ```
    执行完response.status的setter之后就要继续执行response.body的setter了
    ```js
    set body (val) {
      const original = this._body
      this._body = val

      // no content
      if (val == null) {
        if (!statuses.empty[this.status]) {
          if (this.type === 'application/json') {
            this._body = 'null'
            return
          }
          this.status = 204
        }
        if (val === null) this._explicitNullBody = true
        this.remove('Content-Type')
        this.remove('Content-Length')
        this.remove('Transfer-Encoding')
        return
      }
      
      if (!this._explicitStatus) this.status = 200


      /** ⭕️⭕️⭕️⭕️⭕️⭕️⭕️ 执行到这里了 */
      // set the content-type only if not yet set
      // this.has('Content-Type')返回false
      // 通过取反 返回true
      const setType = !this.has('Content-Type')


      // 下面就是根据不同的类型设置不同的'Content-Type'了
      // string
      if (typeof val === 'string') {
        if (setType) this.type = /^\s*</.test(val) ? 'html' : 'text'
        this.length = Buffer.byteLength(val)
        return
      }

      // buffer
      if (Buffer.isBuffer(val)) {
        if (setType) this.type = 'bin'
        this.length = val.length
        return
      }

      // stream
      if (val instanceof Stream) {
        onFinish(this.res, destroy.bind(null, val))
        if (original !== val) {
          val.once('error', err => this.ctx.onerror(err))
          // overwriting
          if (original != null) this.remove('Content-Length')
        }

        if (setType) this.type = 'bin'
        return
      }

      // json
      this.remove('Content-Length')
      this.type = 'json'
    },
    ```
    之后response.body的setter函数中的内容就是根据不同的类型设置不同的'Content-Type'了，之后就return undefined了
    然后我们就继续回到之前的"主线任务", 看看执行微任务队列里的"回到middleware2继续执行"干了什么吧
    ```js
    async middleware2(ctx, next) => {
        // next 就是 dispatch.bind(null, 2)

        console.log(3);

        // next()等于是执行dispatch.bind(null, 2)()
        Promise.resolve("third").then(res => {
            /** ⭕️⭕️⭕️⭕️⭕️⭕️⭕️ 执行到这里了 */
            console.log(res);
        });
        console.log(4);
        return "second"
    }
    ```
    继续打印`"third"`,
    之后继续执行微任务队列中的下一个微任务，就是继续执行`handleRequest函数`
    ```js
    handleRequest(ctx, fnMiddleware) {
      const res = ctx.res;
      res.statusCode = 404;
      const onerror = (err) => ctx.onerror(err);
      const handleResponse = () => respond(ctx);
      console.log(ctx.onerror);
      onFinished(res, onerror);
      return fnMiddleware(ctx).then( /** ⭕️⭕️⭕️⭕️⭕️⭕️⭕️ 执行到这里了 */ handleResponse).catch(onerror);
    }
    ```
    看看`handleResponse`做了什么
    ```js
    const handleResponse = () => /** ⭕️⭕️⭕️⭕️⭕️⭕️⭕️ 执行到这里了 */ respond(ctx);
    ```
    现在要做的就是`响应ctx`了，执行respond(ctx)
    ```js
    function respond(ctx) {
      // allow bypassing koa
      if (ctx.respond === false) return;

      if (!ctx.writable) return;

      // 取出node的http模块提供的原生res对象
      const res = ctx.res;
      let body = ctx.body;
      const code = ctx.status;

      // 我们程序员代码里面对ctx.status赋值的响应码不正确，就忽略响应体
      // ignore body
      if (statuses.empty[code]) {
        // strip headers
        ctx.body = null;
        // 使用node的http模块提供的原生res对象给用户响应内容
        return res.end();
      }

      // 用户端的请求方式是"HEAD", 就没有响应体
      if (ctx.method === "HEAD") {
        if (!res.headersSent && !ctx.response.has("Content-Length")) {
          const { length } = ctx.response;
          if (Number.isInteger(length)) ctx.length = length;
        }
        return res.end();
      }

      // 响应体程序员自己设置的null或者undefined
      // status body
      if (body == null) {
        if (ctx.response._explicitNullBody) {
          ctx.response.remove("Content-Type");
          ctx.response.remove("Transfer-Encoding");
          ctx.length = 0;
          return res.end();
        }
        // http2.0及以上会走的逻辑
        if (ctx.req.httpVersionMajor >= 2) {
          body = String(code);
        } else {
          // http 1.1
          body = ctx.message || String(code);
        }
        if (!res.headersSent) {
          ctx.type = "text";
          ctx.length = Buffer.byteLength(body);
        }
        return res.end(body);
      }

      // 根据ctx.body设置的值的不同，使用不同的方式返回
      // responses
      if (Buffer.isBuffer(body)) return res.end(body);
      if (typeof body === "string") return res.end(body);
      if (body instanceof Stream) return body.pipe(res);

      // body: json
      body = JSON.stringify(body);
      if (!res.headersSent) {
        ctx.length = Buffer.byteLength(body);
      }
      res.end(body);
    }
    ```
    通过res.end()把我们设置到ctx.body的内容响应给用户，至此就完成了响应一个请求的整个流程

# express源码分析
    ```js
    ```
    ```js
    ```
    ```js
    ```
