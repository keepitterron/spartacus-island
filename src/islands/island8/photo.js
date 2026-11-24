// The class photo, Juf Anne's last mission: everyone lines up in front of the Sun Dog, the camera
// swings round to face them, counts down, flashes, and the picture (a real snapshot of the game)
// comes up as a polaroid. It's kept (core/save.js savePhoto): on the ship's deck as a treasure
// (systems/treasures.js), and there's a button to save it as a file.
//
//   startPhoto(spot, { onDone })    spot: the paw mark Spartacus stands on, facing the camera
import { $, vec3 } from '../../core/util.js';
import { renderer, scene, camera, canvas } from '../../core/renderer.js';
import { game } from '../../core/state.js';
import { savePhoto } from '../../core/save.js';
import { sfx } from '../../core/audio.js';
import { showTitleCard } from '../../core/ui.js';
import { player } from '../../player/player.js';

const PHOTO_WIDTH = 720; // px: big enough to look nice, small enough to keep
const CLICK_AT = 3.4; // s into the cutscene: the shutter goes
const SHOW_AT = 4.2; // s: the polaroid comes up

const shoot = { t: 0, spot: null, onDone: null, taken: false, shown: false };

export function startPhoto(spot, { onDone }) {
  Object.assign(shoot, { t: 0, spot, onDone, taken: false, shown: false });
  game.state = 'photo';
  player.pos.set(spot.x, spot.y, spot.z);
  player.vel.set(0, 0, 0);
  player.yaw = 0; // facing the camera (south)
}

game.cutscenes.photo = {
  update(dt) {
    shoot.t += dt;
    const { spot } = shoot;
    // in front of the class, a little above, looking up at them and the Sun Dog behind
    const wanted = vec3(spot.x, spot.y + 2.4, spot.z + 7.5);
    camera.position.lerp(wanted, 1 - Math.exp(-dt * 3));
    camera.lookAt(spot.x, spot.y + 2.6, spot.z - 4);
    player.yaw = 0;
    for (const at of [1, 2, 3])
      if (shoot.t >= at && shoot.t - dt < at) {
        sfx.tick();
        if (at === 2) showTitleCard('Everybody say…', 'CHEESE!');
      }
    if (!shoot.taken && shoot.t >= CLICK_AT) takePicture();
    if (!shoot.shown && shoot.t >= SHOW_AT) showPicture();
  },
  skip() {
    shoot.t = Math.max(shoot.t, CLICK_AT);
  },
};

// draw the frame now and read it straight back (the canvas is only readable until the browser
// shows it), scaled down into a JPEG
function takePicture() {
  shoot.taken = true;
  renderer.render(scene, camera);
  const small = document.createElement('canvas');
  small.width = PHOTO_WIDTH;
  small.height = Math.round((PHOTO_WIDTH * canvas.height) / canvas.width);
  small.getContext('2d').drawImage(canvas, 0, 0, small.width, small.height);
  shoot.url = small.toDataURL('image/jpeg', 0.82);
  savePhoto(shoot.url);
  sfx.shutter();
  $('#flash').classList.add('show');
  setTimeout(() => $('#flash').classList.remove('show'), 120);
}

function showPicture() {
  shoot.shown = true;
  $('#photoImg').src = shoot.url;
  $('#photoSave').href = shoot.url;
  $('#photo').classList.remove('hidden');
  $('#photoOk').focus();
}

function closePicture() {
  $('#photo').classList.add('hidden');
  game.state = 'play';
  canvas.focus();
  shoot.onDone?.();
}
$('#photoOk').addEventListener('click', closePicture);
