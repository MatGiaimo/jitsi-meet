/* global $ */

import Logger from 'jitsi-meet-logger';

import SmallVideo from '../videolayout/SmallVideo';

import { LAYOUTS, getCurrentLayout } from '../../../react/features/video-layout';

const logger = Logger.getLogger(__filename);

/**
 *
 */
export default class SharedVideoThumb extends SmallVideo {
    /**
     *
     * @param {*} participant
     * @param {*} videoType
     * @param {*} VideoLayout
     */
    constructor(participant, videoType, VideoLayout) {
        super(VideoLayout);
        this.id = participant.id;
        this.isLocal = false;
        this.url = participant.id;
        this.videoSpanId = 'sharedVideoContainer';
        this.container = this.createContainer(this.videoSpanId);
        this.$container = $(this.container);
        this._setThumbnailSize();
        this.bindHoverHandler();
        this.isVideoMuted = true;
        this.updateDisplayName();
        this.container.onclick = this._onContainerClick;
    }

    /**
     *
     */
    initializeAvatar() {} // eslint-disable-line no-empty-function

    /**
     *
     * @param {*} spanId
     */
    createContainer(spanId) {
        const container = document.createElement('span');

        container.id = spanId;
        container.className = 'videocontainer';

        var v = window.sharedVideoPlayer;

        // YouTube
        if (v.playerInfo) {
          //add the avatar
          const avatar = document.createElement('img');

          avatar.className = 'sharedVideoAvatar';

          v.addEventListener('onStateChange', function(e){
              if (e.data === 1) {
                let yVideoId = getYoutubeLink(v.getVideoUrl());
                avatar.src = `https://img.youtube.com/vi/${yVideoId}/0.jpg`;
              }
          },false);

          container.appendChild(avatar);
        } else {
          // Video
          var canvas = document.createElement('canvas');
          canvas.id = 'smallVideo';
          var context = canvas.getContext('2d');

          canvas.className = 'sharedVideoAvatar';

          var cw = v.videoWidth || 1280;
          var ch = v.videoHeight || 720;
          canvas.width = cw;
          canvas.height = ch;

          v.addEventListener('play', function(){
            updateVideoThumb(this,context,cw,ch);
          },false);

          container.appendChild(canvas);
        }

        const displayNameContainer = document.createElement('div');

        displayNameContainer.className = 'displayNameContainer';
        container.appendChild(displayNameContainer);

        const remoteVideosContainer
            = document.getElementById('filmstripRemoteVideosContainer');
        const localVideoContainer
            = document.getElementById('localVideoTileViewContainer');

        remoteVideosContainer.insertBefore(container, localVideoContainer);

        return container;
    }

    /**
     * Triggers re-rendering of the display name using current instance state.
     *
     * @returns {void}
     */
    updateDisplayName() {
        if (!this.container) {
            logger.warn(`Unable to set displayName - ${this.videoSpanId
            } does not exist`);

            return;
        }

        this._renderDisplayName({
            elementID: `${this.videoSpanId}_name`,
            participantID: this.id
        });
    }
}

/**
 * Checks if given string is youtube url.
 * @param {string} url string to check.
 * @returns {boolean}
 */
function getYoutubeLink(url) {
    const p = /^(?:https?:\/\/)?(?:www\.)?(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))((\w|-){11})(?:\S+)?$/;// eslint-disable-line max-len


    return url.match(p) ? RegExp.$1 : false;
}

function updateVideoThumb(v,c,w,h) {
    if(v.paused || v.ended) return false;

    setTimeout(updateVideoThumb,20,v,c,w,h);

    const currentLayout = getCurrentLayout(APP.store.getState());

    if (currentLayout !== LAYOUTS.TILE_VIEW && Math.floor(v.getCurrentTime()) % 120 !== 0) {
      return false;
    }

    c.drawImage(v,0,0,w,h);
}
