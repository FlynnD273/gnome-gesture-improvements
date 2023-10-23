// import Gtk from '@gi-types/gtk4';
import Adw from '@gi-types/adw1';

// import { imports } from 'gnome-shell';
import { buildPrefsWidget } from './common/prefs';

import {ExtensionPreferences, gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
// import {Extension} from 'resource:///org/gnome/Shell/Extensions/js/extensions/extension.js';
// const ExtMe = Extension.lookupByUUID('gestureImprovements@gestures');

// eslint-disable-next-line @typescript-eslint/no-empty-function
class GPreferences extends ExtensionPreferences {
	fillPreferencesWindow(prefsWindow: Adw.PreferencesWindow) {
		const UIDirPath = this.dir.get_child('ui').get_path() ?? '';
		const settings = this.getSettings();
		buildPrefsWidget(prefsWindow, settings, UIDirPath);
	}
}

export default GPreferences;
