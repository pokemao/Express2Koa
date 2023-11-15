const axios = require('axios')
/** 断点 */const express = require("express")

/** 断点 */const app = express();

let a = ''

/** 断点 */app.use(
  "/",
  async function middleware0(req, res, next) {
    /** 断点 */a += 1;
    console.log(await next());
    a += 2
    /** 断点 */res.send(a)
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
    /** 断点 */res.send(a)
    return 1
  }
);

/** 断点 */app.listen(3321, () => {
  console.log("run in 3321");
});
