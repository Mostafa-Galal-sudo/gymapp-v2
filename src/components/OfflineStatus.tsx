import { useSyncExternalStore } from 'react';
import { useLanguageStore } from '../store/useLanguageStore';
const subscribe=(fn:()=>void)=>{window.addEventListener('online',fn);window.addEventListener('offline',fn);return()=>{window.removeEventListener('online',fn);window.removeEventListener('offline',fn);};};
export function OfflineStatus(){const online=useSyncExternalStore(subscribe,()=>navigator.onLine);const ar=useLanguageStore(s=>s.lang)==='ar';return online?null:<div className="status-banner" role="status">{ar?'غير متصل · سجلاتك والأطعمة المحفوظة متاحة':'Offline · Your journal and saved foods are available'}</div>;}
