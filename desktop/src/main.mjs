import { app,BrowserWindow,ipcMain } from "electron";
import { autoUpdater } from "electron-updater";
import { join } from "node:path";
import { writeFile } from "node:fs/promises";
import { LocalPOSDatabase } from "./database.mjs";
import { SyncEngine } from "./sync.mjs";
let db,sync,win;
const create=()=>{db=new LocalPOSDatabase(join(app.getPath("userData"),"pos360.sqlite"));const config=db.setting("connection");if(config)sync=new SyncEngine({database:db,...config});win=new BrowserWindow({width:1280,height:800,minWidth:960,minHeight:640,webPreferences:{preload:join(import.meta.dirname,"preload.mjs"),contextIsolation:true,nodeIntegration:false,sandbox:true}});win.loadFile(join(import.meta.dirname,"renderer","index.html"));if(app.isPackaged){autoUpdater.autoDownload=false;autoUpdater.checkForUpdates().catch(()=>{})}};
async function printPending(){const target=db.setting("printerPath"),job=db.nextPrint();if(!target||!job)return false;try{await writeFile(target,job.payload);db.markPrinted(job.id,true);return true}catch{db.markPrinted(job.id,false);return false}}
app.whenReady().then(create);app.on("window-all-closed",()=>{db?.close();if(process.platform!=="darwin")app.quit()});
ipcMain.handle("pos:configure",(_,{baseUrl,token})=>{db.setting("connection",{baseUrl,token});sync=new SyncEngine({database:db,baseUrl,token});return true});
ipcMain.handle("pos:pull",()=>sync?.pull());ipcMain.handle("pos:sync",()=>sync?.push());ipcMain.handle("pos:find",(_,code)=>db.findProduct(code));ipcMain.handle("pos:sale",async(_,sale)=>{const result=db.createSale(sale);await printPending();return result});ipcMain.handle("pos:stats",()=>db.stats());
ipcMain.handle("pos:print",async(_,job)=>{const target=db.setting("printerPath");if(!target)throw new Error("Configure la ruta de la impresora térmica");await writeFile(target,Buffer.from(job.payload));return true});
ipcMain.handle("update:download",()=>autoUpdater.downloadUpdate());ipcMain.handle("update:install",()=>autoUpdater.quitAndInstall(false,true));
