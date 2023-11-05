const foo = async() => {
    await 'haixing'
    return 'nihao'
}

// const main = async() => {
//     return foo()
// }

// main().then(res => console.log(res))

const index = async () => {
    console.log(await foo());
}
index()
