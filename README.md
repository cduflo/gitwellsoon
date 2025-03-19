## Git Well Soon

![128x128](https://user-images.githubusercontent.com/15986207/199504950-32051d31-0a9d-4e79-8a5c-aeb207d3f746.png)

[GET IT in the Chrome App Store](https://chrome.google.com/webstore/detail/git-well-soon/ehpeaofieafibmhiagianfjjblpnmbdo)

### About

Git Well Soon is a Chrome extension (version 1.0.0.0) that automatically persists the 'Hide whitespace changes' setting when reviewing pull requests on GitHub and GitHub Enterprise instances.

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
- **No Special Permissions Required**: Unlike many extensions, Git Well Soon requires no special permissions to function
- **Content Scripts**: Run only on GitHub pull request file views, commit views, and compare views
- **Lightweight Design**: Operates directly in the page context without background processes

The extension was created in response to a GitHub community issue where users requested persistent whitespace settings: [GitHub Community Discussion #5486](https://github.com/community/community/discussions/5486).

### Usage

Simply install the extension and browse GitHub pull requests as usual. The whitespace hiding is enabled by default and will be automatically applied to all pull request file views.
