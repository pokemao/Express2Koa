# Express2Koa
怎么让Express拥有和Koa一样的洋葱模型

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
写在前面：我为使用`app.use`创建的三个中间件起名为`middleware1, middleware2, middleware3`
1. `new Koa()`在干什么

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
    `this`的指向就是`app`，通过`this.middleware.push(fn)`把我们写的中间件`async (ctx, next) => {}`，添加到一个数组中保存起来
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
      return function fn(context, next) {
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
    `compose`这个函数在执行的时候没有对我们的中间件做任何操作，只是校验了一下中间的是不是函数，然后就返回了一个函数，这里我管返回的这个函数叫作`fn`，目的是统一标识符，一会儿就可以看到了，然后`compose`就返回了
    `callback`这个函数使用`fn`这个标识符接受这个函数，然后`callback`这个函数返回函数指针`handleRequest`，函数指针`handleRequest`作为参数传入`http.createServer()`中，这个函数会在每次用户向连接套接字(区别于连接套接字，连接套接字监听连接请求，连接请求到来之后建立请求套接字)发送请求的时候被调用
    `callback()`(也就是`this.callback()`)调用完毕返回`handleRequest`之后，`listen()`(也就是`app.listen()`)也会在调用完毕`server.listen(...args)`之后返回`server`这个对象
    仅仅通过看`handleRequest`这个函数是不能看到什么时候以及怎么调用我们创建的中间件的，接下来看当有请求到来的时候会做什么
4. 当有一个请求到来会发生什么
    当有一个请求到来的时候函数`handleRequest`会被执行
    让我们再看看函数`handleRequest`是什么样子的
    ```js
    const handleRequest = (req, res) => {
      // 通过req和res塑造koa的ctx对象
      const ctx = this.createContext(req, res);
      if (!this.ctxStorage) {
        return this.handleRequest(ctx, fn);
      }
      return this.ctxStorage.run(ctx, async () => {
        return await this.handleRequest(ctx, fn);
      });
    };
    ```


