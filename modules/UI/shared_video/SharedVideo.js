/* global $, APP, YT, interfaceConfig, onPlayerReady, onPlayerStateChange,
onPlayerError */

import Logger from 'jitsi-meet-logger';

import {
    createSharedVideoEvent as createEvent,
    sendAnalytics
} from '../../../react/features/analytics';
import {
    participantJoined,
    participantLeft,
    pinParticipant
} from '../../../react/features/base/participants';
import { VIDEO_PLAYER_PARTICIPANT_NAME } from '../../../react/features/shared-video/constants';
import { dockToolbox, showToolbox } from '../../../react/features/toolbox/actions.web';
import { getToolboxHeight } from '../../../react/features/toolbox/functions.web';
import UIEvents from '../../../service/UI/UIEvents';
import Filmstrip from '../videolayout/Filmstrip';
import LargeContainer from '../videolayout/LargeContainer';
import VideoLayout from '../videolayout/VideoLayout';
import { appendScript , removeScript } from '../../util/helpers.js';

const logger = Logger.getLogger(__filename);

export const SHARED_VIDEO_CONTAINER_TYPE = 'sharedvideo';

/**
 * Example shared video link.
 * @type {string}
 */
const updateInterval = 5000; // milliseconds


/**
 * Manager of shared video.
 */
export default class SharedVideoManager {
    /**
     *
     */
    constructor(emitter) {
        this.emitter = emitter;
        this.isSharedVideoShown = false;
        this.isPlayerAPILoaded = false;
        this.mutedWithUserInteraction = false;
    }

    /**
     * Indicates if the player volume is currently on. This will return true if
     * we have an available player, which is currently in a PLAYING state,
     * which isn't muted and has it's volume greater than 0.
     *
     * @returns {boolean} indicating if the volume of the shared video is
     * currently on.
     */
    isSharedVideoVolumeOn() {
        return this.player
                && this.player.getPlayerState() === YT.PlayerState.PLAYING
                && !this.player.isMuted()
                && this.player.getVolume() > 0;
    }

    /**
     * Indicates if the local user is the owner of the shared video.
     * @returns {*|boolean}
     */
    isSharedVideoOwner() {
        return this.from && APP.conference.isLocalId(this.from);
    }

    /**
     * Start shared video event emitter if a video is not shown.
     *
     * @param url of the video
     */
    startSharedVideoEmitter(url) {

        if (!this.isSharedVideoShown) {
            if (url) {
                this.emitter.emit(
                    UIEvents.UPDATE_SHARED_VIDEO, url, 'start');
                sendAnalytics(createEvent('started'));
            }

            logger.log('SHARED VIDEO CANCELED');
            sendAnalytics(createEvent('canceled'));
        }
    }

    /**
     * Stop shared video event emitter done by the one who shared the video.
     */
    stopSharedVideoEmitter() {

        if (APP.conference.isLocalId(this.from)) {
            if (this.intervalId) {
                clearInterval(this.intervalId);
                this.intervalId = null;
            }
            this.emitter.emit(
                UIEvents.UPDATE_SHARED_VIDEO, this.url, 'stop');
            sendAnalytics(createEvent('stopped'));
        }
    }

    // This code loads a video element and creates player wrapper methods
    initVideoAPI(attributes, url, subUrl)
    {
      const self = this;
      this.initialAttributes = attributes;
      var v = document.createElement("video");
      var subTrack = document.createElement("track");

      v.appendChild(subTrack)
      v.setAttribute("id", "sharedVideoPlayer");
      //v.controls = APP.conference.isLocalId(this.from) ? 1 : 0;
      v.controls = true;
      v.muted = true;
      v.setAttribute("style","height:100%;width:100%");
      v.src = url;

      subTrack.id = "subtitleTrack";
      subTrack.setAttribute("kind","subtitle");
      subTrack.setAttribute("srclang","en-US");
      subTrack.setAttribute("label","English");
      subTrack.src = subUrl;

      // API wrappers
      const playerState = {
          PLAYING: 1,
          PAUSED: 2
      }

      v.playerState = playerState;

      v.playVideo = function() {
        this.play();
      }

      v.pauseVideo = function() {
        this.pause();
      }

      v.isMuted = function() {
        return this.muted;
      }

      v.mute = function() {
        this.muted = true;
      }

      v.unMute = function() {
        this.muted = false;
      }

      v.getPlayerState = function() {
        if (this.paused) return playerState.PAUSED;
        return playerState.PLAYING;
      }

      v.getVolume = function() {
        return this.volume;
      }

      v.setVolume = function(volume) {
        this.volume = volume;
      }

      v.getCurrentTime = function() {
        return this.currentTime;
      }

      v.seekTo = function(time) {
        this.currentTime = time;
      }

      v.destroy = function() {
        this.pause();
        this.removeAttribute('src');
        this.load();
        self.isPlayerAPILoaded = false;
        document.getElementById("sharedVideoPlayer").remove();
        document.getElementById("videoSubContainer").remove();
        removeScript("libs/videosub.js");
      }

      this.video = v;
    }

    initVideoEvents(title) {
      const self = this;

      window.onPlayerStateChange = function(event) {
        self.player = event.target;
        let playing = event.type == 'play' || event.type == 'playing';
        let paused = event.type == 'pause';

        if (playing) {
          if (self.initialAttributes) {
            self.processVideoUpdate(
              self.player,
              self.initialAttributes);

            self.initialAttributes = null;
          }
        } else if (paused) {
          sendAnalytics(createEvent('paused'));
        }

        self.fireSharedVideoEvent(paused)
      };

      window.onVideoProgress = function(event) {
        const state = event.target.getPlayerState();

        if (state == event.target.playerState.PAUSED) {
          self.fireSharedVideoEvent(true);
        }
      };

      window.onVolumeChange = function(event) {
        self.fireSharedVideoEvent();
      };

      window.onPlayerReady = function(event) {
        console.log(event.data);

        if (self.isPlayerAPILoaded) return;

        const player = event.target;

        window.sharedVideoPlayer = player;

        var container = document.getElementById("sharedVideoIFrame");
        container.appendChild(player);

        appendScript("libs/videosub.js");

        let iframe = player;
        player.playVideo();
        // For the browsers - start muted then unmute after play
        player.unMute();
        player.setVolume(.25);

        var url = self.url;

        self.sharedVideo = new SharedVideoContainer(
          { url, iframe, player});

        VideoLayout.addLargeVideoContainer(
          SHARED_VIDEO_CONTAINER_TYPE, self.sharedVideo);

        if (title === 'undefined') title = "Movis";

        APP.store.dispatch(participantJoined({
          conference: APP.conference._room,
          id: self.url,
          isFakeParticipant: true,
          name: title
        }));

        APP.store.dispatch(pinParticipant(self.url));

        // If we are sending the command and we are starting the player
        // we need to continuously send the player current time position
        if (APP.conference.isLocalId(self.from)) {
            self.intervalId = setInterval(
                self.fireSharedVideoEvent.bind(self),
                updateInterval);
        }

        self.isPlayerAPILoaded = true;
      };

      window.onPlayerError = function(event) {
        logger.error('Error in the file player:', event);

        self.errorInPlayer = event.target;
      };

      this.video.addEventListener('canplay', window.onPlayerReady);
      this.video.addEventListener('onprogress', window.onVideoProgress);
      this.video.addEventListener('volumechange',window.onVolumeChange);
      this.video.addEventListener('play', window.onPlayerStateChange);
      this.video.addEventListener('playing', window.onPlayerStateChange);
      this.video.addEventListener('pause', window.onPlayerStateChange);
      this.video.addEventListener('error', window.onPlayerError);
    }

    // This code loads the IFrame Player API code asynchronously.
    initYouTubeAPI(attributes) {
      const tag = document.createElement('script');

      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];

      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

      // sometimes we receive errors like player not defined
      // or player.pauseVideo is not a function
      // we need to operate with player after start playing
      // self.player will be defined once it start playing
      // and will process any initial attributes if any
      this.initialAttributes = attributes;

      const self = this;

      if (self.isPlayerAPILoaded || typeof window.onYouTubeIframeAPIReady === "function") {
          window.onYouTubeIframeAPIReady();
      } else {
          window.onYouTubeIframeAPIReady = function() {
              self.isPlayerAPILoaded = true;
              //const showControls
              //    = APP.conference.isLocalId(self.from) ? 1 : 0;
              const showControls = true;

              let playerVars = {
                  'origin': location.origin,
                  'fs': '0',
                  'autoplay': 0,
                  'controls': showControls,
                  'rel': 0
              };

              let isPlaylist = self.yVideoId.startsWith("PL");

              if (isPlaylist) {
                playerVars.listType = 'playlist';
                playerVars.list = self.yVideoId;
              }

              const p = new YT.Player('sharedVideoIFrame', {
                  height: '100%',
                  width: '100%',
                  videoId: !isPlaylist ? self.yVideoId : '',
                  playerVars: playerVars,
                  events: {
                      'onReady': onPlayerReady,
                      'onStateChange': onPlayerStateChange,
                      'onError': onPlayerError
                  }
              });
              //start muted
              //if (!isPlaylist) p.mute();
              window.sharedVideoPlayer = p;

              // add listener for volume changes
              p.addEventListener(
                  'onVolumeChange', 'onVolumeChange');

              if (APP.conference.isLocalId(self.from)) {
              // adds progress listener that will be firing events
              // while we are paused and we change the progress of the
              // video (seeking forward or backward on the video)
                  p.addEventListener(
                      'onVideoProgress', 'onVideoProgress');
              }
          };
      }
    }

    // Defines the event callbacks used by YouTube
    initYouTubeEvents(url) {
      const self = this;
      /**
       * Indicates that a change in state has occurred for the shared video.
       * @param event the event notifying us of the change
       */
      window.onPlayerStateChange = function(event) {
          // eslint-disable-next-line eqeqeq
          if (event.data == YT.PlayerState.PLAYING) {
              self.player = event.target;

              if (self.initialAttributes) {
                  // If a network update has occurred already now is the
                  // time to process it.
                  self.processVideoUpdate(
                      self.player,
                      self.initialAttributes);

                  self.initialAttributes = null;
              }
              //self.smartAudioMute();
              // eslint-disable-next-line eqeqeq
          } else if (event.data == YT.PlayerState.PAUSED) {
              //self.smartAudioUnmute();
              sendAnalytics(createEvent('paused'));
          }
          // eslint-disable-next-line eqeqeq
          self.fireSharedVideoEvent(event.data == YT.PlayerState.PAUSED);
      };

      /**
       * Track player progress while paused.
       * @param event
       */
      window.onVideoProgress = function(event) {
          const state = event.target.getPlayerState();

          // eslint-disable-next-line eqeqeq
          if (state == YT.PlayerState.PAUSED) {
              self.fireSharedVideoEvent(true);
          }
      };

      /**
       * Gets notified for volume state changed.
       * @param event
       */
      window.onVolumeChange = function(event) {
          self.fireSharedVideoEvent();

          // let's check, if player is not muted lets mute locally
          // if (event.data.volume > 0 && !event.data.muted) {
          //     self.smartAudioMute();
          // } else if (event.data.volume <= 0 || event.data.muted) {
          //     self.smartAudioUnmute();
          // }
          // sendAnalytics(createEvent(
          //     'volume.changed',
          //     {
          //         volume: event.data.volume,
          //         muted: event.data.muted
          //     }));
      };

      window.onPlayerReady = function(event) {
          const player = event.target;

          //player.mute();

          player.playVideo();

          player.unMute();

          const iframe = player.getIframe();

          // eslint-disable-next-line no-use-before-define
          self.sharedVideo = new SharedVideoContainer(
              { url,
                  iframe,
                  player });

          // prevents pausing participants not sharing the video
          // to pause the video
          if (!APP.conference.isLocalId(self.from)) {
              //$('#sharedVideo').css('pointer-events', 'none');
          }

          VideoLayout.addLargeVideoContainer(
              SHARED_VIDEO_CONTAINER_TYPE, self.sharedVideo);

          APP.store.dispatch(participantJoined({

              // FIXME The cat is out of the bag already or rather _room is
              // not private because it is used in multiple other places
              // already such as AbstractPageReloadOverlay.
              conference: APP.conference._room,
              id: self.url,
              isFakeParticipant: true,
              name: VIDEO_PLAYER_PARTICIPANT_NAME
          }));

          APP.store.dispatch(pinParticipant(self.url));

          // If we are sending the command and we are starting the player
          // we need to continuously send the player current time position
          if (APP.conference.isLocalId(self.from)) {
              self.intervalId = setInterval(
                  self.fireSharedVideoEvent.bind(self),
                  updateInterval);
          }
      };

      window.onPlayerError = function(event) {
          logger.error('Error in the player:', event.data);

          // store the error player, so we can remove it
          self.errorInPlayer = event.target;
      };
    }

    /**
     * Shows the player component and starts the process that will be sending
     * updates, if we are the one shared the video.
     *
     * @param id the id of the sender of the command
     * @param url the video url
     * @param attributes
     */
    onSharedVideoStart(id, url, attributes) {
        if (this.isSharedVideoShown) {
            return;
        }

        this.isSharedVideoShown = true;

        // the video url
        this.url = url;

        // the owner of the video
        this.from = id;

        this.mutedWithUserInteraction = APP.conference.isLocalAudioMuted();

        // listen for local audio mute events
        this.localAudioMutedListener = this.onLocalAudioMuted.bind(this);
        this.emitter.on(UIEvents.AUDIO_MUTED, this.localAudioMutedListener);

        // need to check and run youtube or create video tag
        this.yVideoId = getYoutubeLink(url);

        if (!this.yVideoId)
        {
          // check for title https://content~sub~https://subs~title~title
          var title = url.split('~title~');
          var parsedTitle = unescape(title[1]);
          // check for combined subtitle file url and send as subtitle track
          var urls = title[0].split('~sub~');
          url = urls[0];
          this.subTrackUrl = urls[1];
          this.initVideoAPI(attributes, url, this.subTrackUrl);
          this.initVideoEvents(parsedTitle);
        }
        else {
          //this.url = yVideoId;
          this.initYouTubeEvents(this.url);
          this.initYouTubeAPI(attributes);
        }
    }

    /**
     * Process attributes, whether player needs to be paused or seek.
     * @param player the player to operate over
     * @param attributes the attributes with the player state we want
     */
    processVideoUpdate(player, attributes) {
        if (!attributes) {
            return;
        }

        const playerState = typeof YT !== 'undefined' ? YT.PlayerState : player.playerState;

        var isPlaylist = false;

        if (this.yVideoId) isPlaylist = this.yVideoId.startsWith("PL");

        // eslint-disable-next-line eqeqeq
        if (attributes.state == 'playing') {

            if (isPlaylist && attributes.plIdx && player.getPlaylistIndex() !== Number(attributes.plIdx)) {
              player.playVideoAt(attributes.plIdx);
            }

            const isPlayerPaused
                = this.player.getPlayerState() === playerState.PAUSED;

            // If our player is currently paused force the seek.
            this.processTime(player, attributes, isPlayerPaused);

            // Process mute.
            const isAttrMuted = attributes.muted === 'true';

            // if (player.isMuted() !== isAttrMuted) {
            //     this.smartPlayerMute(isAttrMuted, true);
            // }
            //
            // // Process volume
            // if (!isAttrMuted
            //     && attributes.volume !== undefined
            //     // eslint-disable-next-line eqeqeq
            //     && player.getVolume() != attributes.volume) {
            //
            //     player.setVolume(attributes.volume);
            //     logger.info(`Player change of volume:${attributes.volume}`);
            // }

            if (isPlayerPaused) {
                player.playVideo();
            }
            // eslint-disable-next-line eqeqeq
        } else if (attributes.state == 'pause') {
            // if its not paused, pause it
            player.pauseVideo();

            this.processTime(player, attributes, true);
        }
    }

    /**
     * Check for time in attributes and if needed seek in current player
     * @param player the player to operate over
     * @param attributes the attributes with the player state we want
     * @param forceSeek whether seek should be forced
     */
    processTime(player, attributes, forceSeek) {
        if (forceSeek) {
            logger.info('Player seekTo:', attributes.time);
            player.seekTo(attributes.time);

            return;
        }

        // check received time and current time
        const currentPosition = player.getCurrentTime();
        const diff = Math.abs(attributes.time - currentPosition);

        // if we drift more than the interval for checking
        // sync, the interval is in milliseconds
        if (diff > updateInterval / 1000) {
            logger.info('Player seekTo:', attributes.time,
                ' current time is:', currentPosition, ' diff:', diff);
            player.seekTo(attributes.time);
        }
    }

    /**
     * Checks current state of the player and fire an event with the values.
     */
    fireSharedVideoEvent(sendPauseEvent) {
        const playerState = typeof YT !== 'undefined'? YT.PlayerState : this.player.playerState;
        // ignore update checks if we are not the owner of the video
        // or there is still no player defined or we are stopped
        // (in a process of stopping)
        if (!APP.conference.isLocalId(this.from) || !this.player
            || !this.isSharedVideoShown) {
            return;
        }

        const state = this.player.getPlayerState();

        var isPlaylist = false;
        if (this.yVideoId) isPlaylist = this.yVideoId.startsWith("PL");

        var plIdx = -1;
        if (isPlaylist) {
          plIdx = this.player.getPlaylistIndex();
        }

        // if its paused and haven't been pause - send paused
        if (state === playerState.PAUSED && sendPauseEvent) {
            this.emitter.emit(UIEvents.UPDATE_SHARED_VIDEO,
                this.url, 'pause', this.player.getCurrentTime(), false, 100, plIdx);
        } else if (state === playerState.PLAYING) {
            // if its playing and it was paused - send update with time
            // if its playing and was playing just send update with time
            this.emitter.emit(UIEvents.UPDATE_SHARED_VIDEO,
                this.url, 'playing',
                this.player.getCurrentTime(),
                this.player.isMuted(),
                this.player.getVolume(),
                plIdx);
        }
    }

    /**
     * Updates video, if it's not playing and needs starting or if it's playing
     * and needs to be paused.
     * @param id the id of the sender of the command
     * @param url the video url
     * @param attributes
     */
    onSharedVideoUpdate(id, url, attributes) {
        // if we are sending the event ignore
        if (APP.conference.isLocalId(this.from)) {
            return;
        }

        if (!this.isSharedVideoShown) {
            this.onSharedVideoStart(id, url, attributes);

            return;
        }

        // eslint-disable-next-line no-negated-condition
        if (!this.player) {
            this.initialAttributes = attributes;
        } else {
            this.processVideoUpdate(this.player, attributes);
        }
    }

    /**
     * Stop shared video if it is currently showed. If the user started the
     * shared video is the one in the id (called when user
     * left and we want to remove video if the user sharing it left).
     * @param id the id of the sender of the command
     */
    onSharedVideoStop(id, attributes) {
        if (!this.isSharedVideoShown) {
            return;
        }

        if (this.from !== id) {
            return;
        }

        if (!this.player) {
            // if there is no error in the player till now,
            // store the initial attributes
            if (!this.errorInPlayer) {
                this.initialAttributes = attributes;

                return;
            }
        }

        this.emitter.removeListener(UIEvents.AUDIO_MUTED,
            this.localAudioMutedListener);
        this.localAudioMutedListener = null;

        APP.store.dispatch(participantLeft(this.url, APP.conference._room));

        VideoLayout.showLargeVideoContainer(SHARED_VIDEO_CONTAINER_TYPE, false)
            .then(() => {
                VideoLayout.removeLargeVideoContainer(
                    SHARED_VIDEO_CONTAINER_TYPE);

                if (this.player) {
                    this.player.destroy();
                    window.sharedVideoPlayer = null;
                    this.player = null;
                } else if (this.errorInPlayer) {
                    // if there is an error in player, remove that instance
                    this.errorInPlayer.destroy();
                    this.errorInPlayer = null;
                }
                //this.smartAudioUnmute();

                // revert to original behavior (prevents pausing
                // for participants not sharing the video to pause it)
                //$('#sharedVideo').css('pointer-events', 'auto');

                this.emitter.emit(
                    UIEvents.UPDATE_SHARED_VIDEO, null, 'removed');
            });

        this.url = null;
        this.isSharedVideoShown = false;
        this.initialAttributes = null;
        this.isPlayerAPILoaded = false;
    }

    /**
     * Receives events for local audio mute/unmute by local user.
     * @param muted boolena whether it is muted or not.
     * @param {boolean} indicates if this mute was a result of user interaction,
     * i.e. pressing the mute button or it was programmatically triggered
     */
    onLocalAudioMuted(muted, userInteraction) {
        if (!this.player) {
            return;
        }

        const playerState = typeof YT !== 'undefined' ? YT.PlayerState : player.playerState;

        // if (muted) {
        //     this.mutedWithUserInteraction = userInteraction;
        // } else if (this.player.getPlayerState() !== playerState.PAUSED) {
        //     this.smartPlayerMute(true, false);
        //
        //     // Check if we need to update other participants
        //     this.fireSharedVideoEvent();
        // }
    }

    /**
     * Mutes / unmutes the player.
     * @param mute true to mute the shared video, false - otherwise.
     * @param {boolean} Indicates if this mute is a consequence of a network
     * video update or is called locally.
     */
    smartPlayerMute(mute, isVideoUpdate) {
        if (!this.player.isMuted() && mute) {
            this.player.mute();

            if (isVideoUpdate) {
                //this.smartAudioUnmute();
            }
        } else if (this.player.isMuted() && !mute) {
            this.player.unMute();
            if (isVideoUpdate) {
                //this.smartAudioMute();
            }
        }
    }

    /**
     * Smart mike unmute. If the mike is currently muted and it wasn't muted
     * by the user via the mike button and the volume of the shared video is on
     * we're unmuting the mike automatically.
     */
    smartAudioUnmute() {
        if (APP.conference.isLocalAudioMuted()
            && !this.mutedWithUserInteraction
            && !this.isSharedVideoVolumeOn()) {
            sendAnalytics(createEvent('audio.unmuted'));
            logger.log('Shared video: audio unmuted');
            this.emitter.emit(UIEvents.AUDIO_MUTED, false, false);
        }
    }

    /**
     * Smart mike mute. If the mike isn't currently muted and the shared video
     * volume is on we mute the mike.
     */
    smartAudioMute() {
        if (!APP.conference.isLocalAudioMuted()
            && this.isSharedVideoVolumeOn()) {
            sendAnalytics(createEvent('audio.muted'));
            logger.log('Shared video: audio muted');
            this.emitter.emit(UIEvents.AUDIO_MUTED, true, false);
        }
    }
}

/**
 * Container for shared video iframe.
 */
class SharedVideoContainer extends LargeContainer {
    /**
     *
     */
    constructor({ url, iframe, player }) {
        super();

        this.$iframe = $(iframe);
        this.url = url;
        this.player = player;
    }

    /**
     *
     */
    show() {
        const self = this;


        return new Promise(resolve => {
            this.$iframe.fadeIn(300, () => {
                self.bodyBackground = document.body.style.background;
                document.body.style.background = 'black';
                this.$iframe.css({ opacity: 1 });
                APP.store.dispatch(dockToolbox(true));
                resolve();
            });
        });
    }

    /**
     *
     */
    hide() {
        const self = this;

        APP.store.dispatch(dockToolbox(false));

        return new Promise(resolve => {
            this.$iframe.fadeOut(300, () => {
                document.body.style.background = self.bodyBackground;
                this.$iframe.css({ opacity: 0 });
                resolve();
            });
        });
    }

    /**
     *
     */
    onHoverIn() {
        APP.store.dispatch(showToolbox());
    }

    /**
     *
     */
    get id() {
        return this.url;
    }

    /**
     *
     */
    resize(containerWidth, containerHeight) {
        let height, width;

        if (interfaceConfig.VERTICAL_FILMSTRIP) {
            height = containerHeight - getToolboxHeight();
            width = containerWidth - Filmstrip.getVerticalFilmstripWidth();
        } else {
            height = containerHeight - Filmstrip.getFilmstripHeight();
            width = containerWidth;
        }

        this.$iframe.width(width).height(height);
    }

    /**
     * @return {boolean} do not switch on dominant speaker event if on stage.
     */
    stayOnStage() {
        return false;
    }
}
