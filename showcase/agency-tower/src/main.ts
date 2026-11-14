import './ui/style.css';
import { boot } from './app/bootstrap';
import { parseParams } from './app/params';
import { startSceneApp } from './app/sceneApp';
import roster from './data/roster.generated.json';
import hierarchy from './data/hierarchy.json';

function hasWebGL2(): boolean {
  try {
    return document.createElement('canvas').getContext('webgl2') !== null;
  } catch {
    return false;
  }
}

const root = document.getElementById('app');
if (root) {
  const params = parseParams(window.location.search);
  void boot({
    root,
    loadRaw: () => Promise.resolve({ roster, overlay: hierarchy }),
    hasWebGL2,
    startScene: (ctx) => startSceneApp(ctx, params),
  });
}
