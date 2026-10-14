import { createCloudDensity } from '../src/scene/cloudDensity';
import { createCloudCard } from '../src/scene/cloudCard';
import { createCloudShadowAtlas } from '../src/scene/cloudShadow';
const volumes=[];
const output=new URL('../public/clouds/',import.meta.url);
for(const seed of [713,1949,3571]){
 const volume=createCloudDensity(seed,128),card=createCloudCard(volume);
 for(const [kind,texture] of [['volume',volume],['card',card]] as const){
  const data=texture.image.data as Uint8Array,compressed=Bun.gzipSync(data);
  await Bun.write(new URL(`formation-${seed}.${kind}.bin`,output),compressed);
  console.log(`${seed} ${kind}: ${data.length} bytes → ${compressed.length} compressed`);
 }
 volumes.push(volume);card.dispose();
}

const shadows=createCloudShadowAtlas(volumes);
await Bun.write(new URL('sun-footprints.bin',output),Bun.gzipSync(shadows.image.data as Uint8Array));
volumes.forEach(volume=>volume.dispose());shadows.dispose();
