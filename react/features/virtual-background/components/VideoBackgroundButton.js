// @flow

import { openDialog } from '../../base/dialog';
import { translate } from '../../base/i18n';
import { IconVirtualBackground } from '../../base/icons';
import { connect } from '../../base/redux';
import { AbstractButton } from '../../base/toolbox/components';
import type { AbstractButtonProps } from '../../base/toolbox/components';
import { isLocalCameraTrackMuted } from '../../base/tracks';

import { VirtualBackgroundDialog } from './index';

/**
 * The type of the React {@code Component} props of {@link VideoBackgroundButton}.
 */
type Props = AbstractButtonProps & {

    /**
     * True if the video background is blurred or false if it is not.
     */
    _isBackgroundEnabled: boolean,

    /**
     * Whether video is currently muted or not.
     */
    _videoMuted: boolean,

    /**
     * The redux {@code dispatch} function.
     */
    dispatch: Function
};

/**
 * An abstract implementation of a button that toggles the video background dialog.
 */
class VideoBackgroundButton extends AbstractButton<Props, *> {
    accessibilityLabel = 'toolbar.accessibilityLabel.selectBackground';
    icon = IconVirtualBackground;
    label = 'toolbar.selectBackground';
    tooltip = 'toolbar.selectBackground';

    /**
     * Handles clicking / pressing the button, and toggles the virtual background dialog
     * state accordingly.
     *
     * @protected
     * @returns {void}
     */
    _handleClick() {
        const { dispatch } = this.props;

        dispatch(openDialog(VirtualBackgroundDialog));
    }

    /**
     * Returns {@code boolean} value indicating if the background effect is
     * enabled or not.
     *
     * @protected
     * @returns {boolean}
     */
    _isToggled() {
        return this.props._isBackgroundEnabled;
    }

    /**
     * Returns {@code boolean} value indicating if disabled state is
     * enabled or not.
     *
     * @protected
     * @returns {boolean}
     */
    _isDisabled() {
        return this.props._videoMuted;
    }
}

/**
 * Maps (parts of) the redux state to the associated props for the
 * {@code VideoBackgroundButton} component.
 *
 * @param {Object} state - The Redux state.
 * @private
 * @returns {{
 *     _isBackgroundEnabled: boolean
 * }}
 */
function _mapStateToProps(state): Object {
    const tracks = state['features/base/tracks'];

    return {
        _isBackgroundEnabled: Boolean(state['features/virtual-background'].backgroundEffectEnabled),
        _videoMuted: isLocalCameraTrackMuted(tracks)
    };
}

export default translate(connect(_mapStateToProps)(VideoBackgroundButton));
