const Koa = require('koa')

const app = new Koa();

let a = ""

app.use(async (ctx, next) => {
    ctx.body = "一大长串数据"
})

app.listen('3222', () => {
    console.log('run in 3222');
})
