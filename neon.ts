import {defineConfig} from '@neon/config/v1';

export default defineConfig({
 buckets:{'radar-raw':{access:'private'}},
 functions:{radarsync:{name:'Denní aktualizace MONITOR',source:'./functions/sync.ts',env:{RAW_STORAGE_BUCKET:'radar-raw'}}},
 triggers:{'daily-monitor-sync':{type:'schedule',function:'radarsync',cron:'17 3 * * *'}},
});
