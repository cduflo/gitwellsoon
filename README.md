## Git Well Soon

![128x128](https://user-images.githubusercontent.com/15986207/199504950-32051d31-0a9d-4e79-8a5c-aeb207d3f746.png)

[GET IT in the Chrome App Store](https://chrome.google.com/webstore/detail/git-well-soon/ehpeaofieafibmhiagianfjjblpnmbdo)

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/Z8Z11M8JYN)

### About

Git Well Soon is a Chrome extension (version 2.0.0.0) that automatically persists the 'Hide whitespace changes' setting when reviewing pull requests on GitHub and GitHub Enterprise instances.

The name is cheeky way of saying I hope GitHub will implement this feature themselves and make my extension obsolete, Git Well Soon!

### Features

- **Automatic Whitespace Handling**: Automatically adds the whitespace hiding query parameter (`w=1`) to GitHub pull request URLs
- **Works with GitHub & GitHub Enterprise**: Compatible with both public GitHub and private GitHub Enterprise instances
- **User Preference Respect**: Honors manual user toggles of the whitespace setting
- **Seamless Integration**: Works behind the scenes without requiring any user configuration
- **Minimal Permissions**: Uses only the necessary permissions to function, enhancing your privacy and security

### How It Works

When you navigate to a pull request page with the `/files` view on GitHub or GitHub Enterprise, the extension:

1. Detects if you're on a GitHub pull request page
2. Checks if the whitespace parameter is already set
3. If not set, automatically adds `?w=1` to hide whitespace changes
4. Respects manual changes to the whitespace setting by monitoring the checkbox

### Technical Details

- **Manifest Version**: 3
- **Permissions**: Uses the "storage" permission and optional host permissions that are requested at runtime via the popup when you add enterprise hosts. No background/service worker; no scripting permission.
- **Content Scripts**: Run on GitHub pull request file views, commit views, and compare views. When you grant an enterprise host, the extension also runs on that host for the same routes.
- **Lightweight Design**: Operates directly in the page context without background processes

The extension was created in response to a GitHub community issue where users requested persistent whitespace settings: [GitHub Community Discussion #5486](https://github.com/community/community/discussions/5486).

### Usage

Simply install the extension and browse GitHub pull requests as usual. The whitespace hiding is enabled by default and will be automatically applied to all pull request file views.

### Enterprise hosts

To enable the extension on a custom GitHub Enterprise domain:

1. Click the extension’s toolbar icon to open the popup.
2. Enter your host (for example: `https://github.company.com`) and click Add.
3. Accept the one-time “Site access” permission prompt for that host.
4. Reload the target tab; `w=1` will be applied on PR files/compare/commit(s) routes on that host.
