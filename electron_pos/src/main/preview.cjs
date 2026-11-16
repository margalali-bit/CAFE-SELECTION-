// Development preview only. Electron is the production desktop runtime.
const http=require('node:http');
const {readFileSync}=require('node:fs');
const {join,extname}=require('node:path');
const {Service}=require('./service.cjs');
const {receiptHTML}=require('./receipt.cjs');
const service=new Service(process.env.CAFE_PREVIEW_DB||join(__dirname,'../../../preview-data.sqlite'));
const port=Number(process.env.PORT||4173);
const methods=new Set(['setup','login','logout','state','saveCategory','saveProduct','saveUser','saveSettings','customer','checkout','receipt','cancel','closeShift','confirmShift','payment','expense','report']);
const server=http.createServer(async(req,res)=>{res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Cache-Control','no-store');try{if(req.method==='POST'&&req.url==='/api'){if(req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`)throw Error('Origin rejected');let text='';for await(const chunk of req){text+=chunk;if(text.length>64000)throw Error('Request too large');}const {method,token,args={}}=JSON.parse(text);let value;if(method==='info')value={setup:!service.db.prepare('SELECT 1 FROM users LIMIT 1').get(),sync:{configured:false,state:'offline'},version:'0.2.0-preview'};else{if(!methods.has(method))throw Error('Unavailable in browser preview');value=method==='setup'||method==='login'?service[method](args):service[method](token,args);}res.setHeader('Content-Type','application/json');res.end(JSON.stringify({ok:true,value}));return;}if(req.method==='GET'){const path={'/':'index.html','/app.js':'app.js','/style.css':'style.css','/assets/teapot.svg':'assets/teapot.svg'}[req.url];if(!path){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',{'html':'text/html;charset=utf-8','.js':'text/javascript;charset=utf-8','.css':'text/css','.svg':'image/svg+xml'}[extname(path)]||'text/html;charset=utf-8');res.end(readFileSync(join(__dirname,'../renderer',path)));return;}res.writeHead(405);res.end();}catch(e){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({ok:false,error:e.message}));}});
server.listen(port,'127.0.0.1',()=>console.log(`Café Sélection preview: http://127.0.0.1:${port}`));
process.on('SIGTERM',()=>server.close(()=>{service.close();process.exit();}));
