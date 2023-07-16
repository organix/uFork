# A SublimeLinter plugin for uFork assembly.

# Only Sublime views whose syntax type is set to assembly will be linted. This
# may require the installation of a syntax package such as
# https://github.com/dougmasten/sublime-assembly-6809.

# To install this plugin, first install the SublimeLinter package. Create a
# directory in Sublime's Packages directory called "SublimeLinter-asm".
# The location of the Packages directory depends on your operating system:

#   MacOS: ~/Library/Application Support/Sublime Text/Packages
#   Windows: %AppData%\Sublime Text\Packages
#   Linux: ~/.config/sublime-text/Packages

# Soft link this file into the "SublimeLinter-asm" directory, and
# run "Reload SublimeLinter and its Plugins" from the command palette.

from os import path
from SublimeLinter.lint import Linter, STREAM_STDOUT

class asm(Linter):
    cmd = [
        "node",
        path.normpath(
            path.join(
                path.dirname(path.realpath(__file__)),
                "asm_linter.js"
            )
        )
    ]
    regex = r'^(?P<line>\d+):(?P<col>\d+) (?P<message>.*)'
    multiline = False
    error_stream = STREAM_STDOUT
    defaults = {'selector': 'source.asm, source.mc6809'}
