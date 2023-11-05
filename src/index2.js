const Koa = require('../koa/lib/application')
const axios = require('axios')

const app = new Koa();

let a = ""

app.use(async (ctx, next) => {
    ctx.body = "一大长串数据"
})

app.listen('3222', () => {
    console.log('run in 3222');
})
