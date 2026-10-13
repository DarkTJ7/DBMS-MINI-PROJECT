import {spawn,execFileSync} from 'node:child_process';
export function keepDatabaseAlive() {
 if(process.platform!=='win32'||!process.env.DATABASE_URL?.includes('@127.0.0.1:5432/pantrychef_app'))return null;
 // WSL may stop an idle distro even while Windows is using its forwarded port.
 // Keep one owned Linux process alive for the app's lifetime.
 const child=spawn('wsl',['-d','Ubuntu','--','tail','-f','/dev/null'],{stdio:'ignore',windowsHide:true});
 child.on('error',()=>{});
 try{execFileSync('wsl',['-d','Ubuntu','-u','root','--','pg_ctlcluster','16','main','start'],{stdio:'pipe',windowsHide:true});}catch(e){if(e.status!==2){child.kill();throw e;}}
 process.once('exit',()=>child.kill());
 return child;
}
