/**
 * @fileOverview Media FullScreen Slideshow class
 * @version 1.0
 */


/**
 * A Player: an object to manage
 * video tag instances along with the
 * compatibility for different browsers.
 * It accept a json url or an object literal
 * of items to be played.
 *
 * @requires jQuery >= 1.6
 * @requires browserDetect >= ?
 * @requires Modernizr >= ?
 *
 * @constructor
 * @this {VPlayerController}
 * @param {string} id The DOM id referring to the video container
 */
var VPlayerController = function(conf) {
    if (arguments.length !== 1) {
        throw new Error("VPlayerController constructor called with " +
                        arguments.length + "arguments, but expected 1.");
    }

    // Basic properties
    this.crop_width = conf.crop_width ? conf.crop_width : null;
    this.crop_height =  conf.crop_height ? conf.crop_height : null;
    this.crop_vertical = conf.crop_vertical ? conf.crop_vertical : "center";
    this.crop_horizontal = conf.crop_horizontal ? conf.crop_horizontal : "center";

    this.container = document.getElementById(conf.container_id);
    this.container_id = conf.container_id;
    this.video = document.querySelector('#' + this.container.id + ' video');
    this.poster = document.querySelector('#' + this.container.id + ' img');

    this.is_buffering = true;
    this.playable = false;
    this.prev_time = 0;
    this.loop = conf.loop ? conf.loop : false; // Repeat a single video
    this.repeat = conf.repeat ? conf.repeat : false; // Repeat the whole playlist top->bottom
    this.autoplay = conf.autoplay ? conf.autoplay : false;
    this.starting_video_id = conf.starting_video_id ? parseInt(conf.starting_video_id, 10) : 0;
    this.current_id = this.starting_video_id;
    this.json_url = conf.json_url;
    this.video_list = conf.video_list ? conf.video_list : false; // It's an object literal
    if (!this.video_list) {
        this.load_json();
    }
    else {
        this.load_scene(this.starting_video_id);
    }
    // Hide the poster image
    // to show it only onload.
    $(this.poster).hide();

    /**
     * On play event function
     *
     * @param {Object} event
     */
    this.on_play = function(event) {
    };

    /**
     * On pause event function
     *
     * @param {Object} event
     */
    this.on_pause = function(event) {
    };

    // Buffered, go!
    this.on_canplay = function(event) {
        $(this.container).trigger('buffered');
    };
    this.on_playing = function(event) {
        this.hide_poster();
        $(this.container).trigger('buffered');
    };
    this.on_canplaythrough = function(event) {
        $(this.container).trigger('buffered');
    };

    // Buffering, wait!
    this.on_stalled = function(event) {
        // This creates some problems in some browsers
        // as it triggers stalled even if the video
        // is running smoothly. Needs more information...

        // $(this.container).trigger('buffering');
    };
    this.on_waiting = function(event) {
        $(this.container).trigger('buffering');
    };

    /**
     * On error event function
     *
     * @param {Object} event
     */
    this.on_error = function(event) {
        $(this.container).trigger('buffering');
    };
    this.on_seeking = function(event) {
        $(this.container).trigger('buffering');
    };

    /**
     * On progress event function to manage buffering.
     *
     * readyState shouldn't be used for buffering ispection,
     * probably is better to use canplay/canplaythrough
     *
     * @param {Object} event
     */
    this.on_progress = function() {
        if (this.playable) {
            this.current_time = this.video.currentTime;
            this.duration = Math.round(this.video.duration);
            this.buffered = Math.round(this.video.buffered.end(this.video.buffered.length-1));
            this.percentage = Math.round((this.buffered*100)/this.duration);

            // If the video is not paused, check current time
            // and previous "on-progeress" time to see if they differ.
            // If so the video is playing and so is buffered, otherwise,
            // it is probably buffering.
            if (!this.video.paused) { // Playing
                if (this.current_time !== this.prev_time) {
                    $(this.container).trigger('buffered');
                    this.prev_time = this.current_time;
                } else if (this.current_time !== 0) {
                    $(this.container).trigger('buffering');
                } else {
                    this.prev_time = 0;
                }
            } else { // Pause
                // If the video is paused and the buffered
                // is more than the current paused time.
                // There should be something to see,
                // otherwise wait.
                if (this.buffered > this.current_time) {
                    $(this.container).trigger('buffered');
                } else {
                    $(this.container).trigger('buffering');
                }
            }

        }
    };

    this.on_timeupdate = function(event) {
        $(this.container).trigger('buffered');
    };

    /**
     * On buffered/buffering event function
     *
     * @param {Object} event
     */
    this.on_buffered = function(event) {
    };

    this.on_buffering = function(event) {
    };

    /**
     * Do the heavy lifting when video is loaded
     *
     * @param {Object} event
     */
    this.on_loaded_data = function(event) {
        this.resize();
    };

    /**
     * Do something when metadata has loaded
     *
     * @param {Object} event
     */
    this.on_loaded_metadata = function(event) {
        // Not supported by IE, Chrome and Opera
    };

    /**
     * Update the context on window resize
     *
     * @param {Object} event
     */
    this.on_window_resize = function(event) {
        this.resize();
    };

    this.on_orientationchange = function (event_data) {
        this.resize();
    };

    /**
     * Do the heavy lifting when video playback ends.
     * If loop is active, the currently selected video
     * will repeat forever.
     * If repeat is true, the whole playlist will be
     * repeated forever, otherwise the system stops.
     *
     * @param {Object} event
     */
    this.on_ended = function (event) {
        if (this.loop) {
            this.play();
        } else if (this.repeat)  {
            this.next();
        } else {
            this.stop();
        }
    };

    /**
     * On load poster image function
     *
     * Only when the image in indeed loaded,
     * we can consider the scene ready to be
     * used. So show the image and trigger
     * scene_loaded event.
     *
     */
    this.on_load_poster = function() {
        this.show_poster();

        // setTimeout seems to put the execution
        // at the bottom of the stack. Is it possbile?
        var that = this;
        setTimeout(function () {
            $(that.container).trigger(
                'scene_loaded',
                that.current_id);
        },0);
    };

    /**
     * On scene loaded custom event
     *
     */
    this.on_scene_loaded = function(e, id) {
        // Resize poster and video
        this.resize();

        //if ((BrowserDetect.dataOS[0].string !== 'iPad') &&
        //    (BrowserDetect.OS !== 'iPhone/iPod')) {
        //    this.video.load();
        //}

        if (this.autoplay) {
            this.play();
        }
    };

    /**
     * On prev scene loaded custom event
     *
     */
    this.on_prev_loaded = function() {
    };

    /**
     * On next scene loaded custom event
     *
     */
    this.on_next_loaded = function() {
    };

    /**
     * Show image. A poster default alternative.
     * Then, if there is a video, start it or load it
     * otherwise, simply keep the current image
     *
     */
    this.show_poster = function() {
        $(this.poster).show();
    };

    /**
     * Hide image.
     *
     */
    this.hide_poster = function() {
        $(this.poster).hide();
    };

    /**
     * Show/hide video
     *
     */
    this.show_video = function() {
        $(this.video).show();
    };

    this.hide_video = function() {
        $(this.video).hide();
    };

    /**
     * Playback evolved probably video and audio
     * fade should last equal time.
     *
     */
    this.play = function(callback) {
        if (this.playable) {
            this.show_video();
            this.video.play();
            if (callback) {
                callback.call(this);
            }
        }
    };

    /**
     * Pause evolved: probably video and audio
     * fade should last equal time.
     *
     */
    this.pause = function(callback) {
        this.video.pause();
        if (callback) {
            callback.call(this);
        }
    };

    /**
     * Stop evolved: this method trigger a stop
     * and put the current time to 0 (do a real stop)
     * only if a played TimeRange has been created
     * (aka a play has been invoked).
     *
     */
    this.stop = function(callback) {
        // The played attribute return a new static
        // normalized TimeRanges object that represents
        // the ranges of the media resource that
        // the user agent has so far rendered.
        if (this.playable &&
            // this.video.paused && // Don't know way
            (this.video.played.length !== 0)) { // The video has been played at least one time.
            this.pause(function() {
                this.video.currentTime = 0;
            });
        }
        $(this.video).trigger('stop');
    };

    this.on_stop = function(e) {
        this.show_poster();
    };

    /**
     * Volume change
     *
     * @param {Object} event
     */
    this.on_volume_change = function (event) {
    };

    /**
     * Audio fade in
     *
     */
    this.vol_fadein = function(ramp_time, target_vol, tick) {
    };

    /**
     * Audio fade out
     *
     */
    this.vol_fadeout = function(ramp_time, callback, target_vol, tick ) {
    };

   /**
     * Audio toggle mute
     *
     */
    this.toggle_mute = function(el) {
    };

    /**
     * Prev scene setup (video and image)
     *
     */
    this.prev = function() {
        if (this.current_id === 0) {
            this.load_scene(this.video_list.length-1);
        } else {
            this.load_scene(parseInt(this.current_id, 10)-1);
        }
        $(this.container).trigger('prev_loaded');
    };

    /**
     * Next scene setup (video and image)
     *
     */
    this.next = function() {
        if (this.current_id === this.video_list.length-1) {
            this.load_scene(0);
        } else {
            this.load_scene(parseInt(this.current_id, 10)+1);
        }
        $(this.container).trigger('next_loaded');
    };

    // Event listeners, at the end beacuse must be loaded
    // after the function has been creted. Otherwise prototype
    // should be used for functions definition.
    //
    window.addEventListener(
        "resize",
        this.on_window_resize.context(this),
        false);
    this.poster.addEventListener(
        "load",
        this.on_load_poster.context(this),
        false);
    this.video.addEventListener(
        "loadeddata",
        this.on_loaded_data.context(this),
        false);
    this.video.addEventListener(
        "loadedmetadata",
        this.on_loaded_metadata.context(this),
        false);
    this.video.addEventListener(
        "play",
        this.on_play.context(this),
        false);
    this.video.addEventListener(
        "canplaythrough",
        this.on_canplaythrough.context(this),
        false);
    this.video.addEventListener(
        "playing",
        this.on_playing.context(this),
        false);
    this.video.addEventListener(
        "pause",
        this.on_pause.context(this),
        false);
    this.video.addEventListener(
        "ended",
        this.on_ended.context(this),
        false);
    this.video.addEventListener(
        'volumechange',
        this.on_volume_change.context(this),
        false);
    this.video.addEventListener(
        'error',
        this.on_error.context(this),
        false);
    this.video.addEventListener(
        'progress',
        this.on_progress.context(this),
        false);
    this.video.addEventListener(
        'canplay',
        this.on_canplay.context(this),
        false);
    this.video.addEventListener(
        'stalled',
        this.on_stalled.context(this),
        false);
    this.video.addEventListener(
        'waiting',
        this.on_waiting.context(this),
        false);
    this.video.addEventListener(
        'timeupdate',
        this.on_timeupdate.context(this),
        false);
    this.video.addEventListener(
        'timeupdate',
        this.on_timeupdate.context(this),
        false);
    window.addEventListener(
        'orientationchange',
        this.on_orientationchange.context(this),
        false);

    // Custom events
    $(document).delegate(
        "#" + this.container_id,
        "scene_loaded",
        this.on_scene_loaded.context(this)
    );
    $(document).delegate(
        "#" + this.container_id,
        "next_loaded",
        this.on_next_loaded.context(this)
    );
    $(document).delegate(
        "#" + this.container_id,
        "prev_loaded",
        this.on_prev_loaded.context(this)
    );
    $(document).delegate(
        "#" + this.container_id,
        "buffered",
        this.on_buffered.context(this)
    );
    $(document).delegate(
        "#" + this.container_id,
        "buffering",
        this.on_buffering.context(this)
    );
    $(document).delegate(
        "#" + this.container_id,
        "stop",
        this.on_stop.context(this)
    );
};


/**
 * Aux function to resize both poster and video
 *
 */
VPlayerController.prototype.resize = function() {
    this.crop_resize(this.video);
    this.crop_resize(this.poster);
};


/**
 * Resize opportunely the poster and the video
 * and crop the to fit the screen.
 *
 */
VPlayerController.prototype.crop_resize = function(item, options) {
    item = $(item);
    var defaults = {};
    if (options) {
         defaults = {
            width: options.crop_width ? options.crop_width : $(window).width(),
            height: options.crop_height ? options.crop_height : $(window).height(),
            vertical: options.crop_vertical ? options.crop_vertical : "center",
            horizontal: options.crop_horizontal ? options.crop_horizontal : "center"
        };
    } else {
        defaults = {
            width: this.crop_width ? this.crop_width : $(window).width(),
            height: this.crop_height ? this.crop_height : $(window).height(),
            vertical: this.crop_vertical ? this.crop_vertical : "center",
            horizontal: this.crop_horizontal ? this.crop_horizontal : "center"
        };
    }

    var resize_options = $.extend(defaults, options);
    // If it's a video get dimensions differently
    if (item[0].videoWidth){
        width = item[0].videoWidth;
        height = item[0].videoHeight;
    } else {
        width = item.width();
        height = item.height();
    }

    item_ratio = width / height;
    viewport = resize_options.width / resize_options.height;

    // Set the correcto proportion based on window ratio
    if (viewport >= item_ratio) {
        proportion = resize_options.width / width;
    } else {
        proportion = resize_options.height / height;
    }

    if (proportion) {

        // Reset positioning
        // item.css("position", "relative");
        item.css("top", "auto");
        item.css("bottom", "auto");
        item.css("left", "auto");
        item.css("right", "auto");

        item.width(Math.round(proportion * width));
        item.height(Math.round(proportion * height));

        // Crop based on options
        switch(resize_options.horizontal) {
        case 'left':
            item.css("left", 0);
            break;
        case 'right':
            item.css("right", 0);
            break;
        case 'center':
            // Fall through
        default:
            item.css(
                "left",
                ((item.width() - resize_options.width) / -2) + "px");
        }
        switch(resize_options.vertical) {
        case 'top':
            item.css("top", 0);
            break;
        case 'bottom':
            item.css("bottom", 0);
            break;
        case 'center':
            // Fall through
        default:
            item.css(
                "top",
                ((item.height() - resize_options.height) / -2) + "px");
        }
    }
};


/**
 * Load and parse a JSON object
 *
 */
VPlayerController.prototype.load_json = function() {
    // Execute a closure to get the JSON contents and
    // setup starting video and poster image
    var that = this;
    (function() {
        $.getJSON(that.json_url, function(json) {
            that.video_list = json.videos;
            that.load_scene(that.starting_video_id);
        });
    }());
};


/**
 * Load a video from a JSON object using its id
 *
 * @requires Modernizr
 */
VPlayerController.prototype.load_scene = function(id) {
    this.previous_id = this.current_id;
    this.next_id = this.video_list[this.current_id+1];
    this.current_id = parseInt(id, 10);
    obj = this.video_list[id];

    // FIXME: this is not quite abstract, if the
    //  json changes this must be changed as well.
    this.title = obj.title;
    this.project = obj.project;
    this.category = obj.category;

    // Hide current poster.
    //
    // FIXME: should be the class method
    // poster_hide, but for some MRO related reasons
    // it doesn't work as expected.
    $(this.poster).hide();

    // Initialize and load poster
    // FIX: set a default in case some sizes are undefined
    this.poster.src = "";
    var width = $(window).width();
    if (width <= 1024) {
        this.poster.src = obj.poster_smartphone;
    } else if(width > 1024 && width <= 1280) {
        this.poster.src = obj.poster_tablet;
    } else {
        this.poster.src = obj.poster_desktop;
    }

    // Load video, and manage playability:
    // if a source is present, let the user play it
    // otherwise disable all the player controls
    if (Modernizr.video &&
        Modernizr.video.h264 &&
        (obj.video_h264 !== undefined)) {
        this.video.setAttribute("src", obj.video_h264);
        this.playable = true;
    } else if (Modernizr.video &&
               Modernizr.video.webm &&
               (obj.video_webm !== undefined)) {
        this.video.setAttribute("src", obj.video_webm);
        this.playable = true;
    } else {
        this.video.setAttribute("src", "");
        this.playable = false;
    }
};


/**
 * Check for browser compatibility with video.
 *
 * @requires BrowserDetect
 */
// VPlayerController.prototype.compatible = function() {
//     this.browser = {
//         'Firefox': function (version) {
//             return version < 3 ? false : true;
//         },
//         'Chrome': function (version) {
//             return version < 4 ? false : true;
//         },
//         'Safari': function (version) {
//             return version < 3 ? false : true;
//         },
//         'Opera': function (version) {
//             return true;
//         },
//         'Explorer': function (version) {
//             if (version < 9) {
//                 return false;
//             } else {
//                 return true;
//             }
//         }
//     };
//     return this.browser[BrowserDetect.browser](
//         parseInt(BrowserDetect.version, 10));
// };


/**
 * Utility: extends the Function object with
 * a method to bind an object to the
 * scope of a function. It's bind in newer
 * browsers.
 *
 * @this {function}
 * @param {Object} The object context to bind
 */
if (!Function.prototype.context) {
    Function.prototype.context = function(object) {
        var fn = this;
        return function() { return fn.apply(object, arguments); };
    };
}