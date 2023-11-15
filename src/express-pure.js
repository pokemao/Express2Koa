const axios = require('axios')
const express = require("express")

const app = express();

let a = ''

app.use(
  "/",
  async function middleware0(req, res, next) {
    if(req.url !== '/') return
    console.log(req.path)
    a += 1;
    console.log(await next());
    a += 2
    res.send(a)
  },
  async function middleware1(req, res, next) {
    a += 3;
    const b = await next();
    console.log('b', b);
    a += 4;
  },
  async function middleware2(req, res, next) {
    const data = await axios.get("http://localhost:3222/");
    a += data.data;
    return 1
  }
);

app.listen(3321, () => {
  console.log("run in 3321");
});
