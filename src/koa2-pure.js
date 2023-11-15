const Koa = require('koa')
const axios = require('axios')

/** 断点 */const app = new Koa();

let a = ""

/** 断点 */app.use(async function middleware0(ctx, next) {
    if(ctx.url !== '/') return
    /** 断点 */a += 1
    await next();
    /** 断点 */a += 2
    console.log(a);
    ctx.body = a
})

app.use(async function middleware1(ctx, next) {
    /** 断点 */a += 3
    await next()
    a += 4
})

app.use(async function middleware2(ctx, next) {
    /** 断点 */const res = await axios.get("http://localhost:3222/")
    a += res.data
})

/** 断点 */app.listen('3124', () => {
    console.log('run in 3124');
})
