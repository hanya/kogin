
# Kogin help
Kogin is application to draw pattern for both Tsugaru kogin-zashi
 and Nanbu hishi-zashi.

## Data format
The pattern data drawn by Kogin is stored as SVG image. Stored file
 can be seen directory by web browser. And it can be embedded in web pages.
The SVG file for the pattern contains data for Kogin and it can be re-edited.

The SVG file stored by Kogin can be modified by software such as Inkscape.
But once you edit the file, you can not open the file by Kogin anymore.
Use the pattern as imported file to your document.

There are two kind of settings, one for web pages for screen and
 another for printing purpose.

## PDF export
There is function to write pattern as PDF file. The exported PDF file
 can be opened by PDF viewer.

Printing option is applied to PDF export.

## Web storage support (Web application)
There are some web storages supported by Kogin.
Only simple manipulation of files is supported.

### Google Drive
You need account for Google Drive.

### Dropbox
You need account for Dropbox.

Files from Dropbox can be opend if you have opened a file from Dropbox.
Select SVG file and then choose open by - other application after that link to Kogin.
Now you can choose open by - Kogin.
Once you opened file through the linked application, you can open other files
 because of authorized.

## Repository support
Only template files can be loaded from Github and Gitlab.
Writing to these repositories are not supported.

## Copy and paste (Web application)
Both copy and paste functions can work only in the own document.
If you want to paste to another document, save pattern into template and then use it.
There is function to save selected part as template through context menu
 shown by right click.

## Menu description
Describes commands shown through left most button in the top toolbar.

### Save file
If current file is stored in somewhere, over write existing file.

### Save as
Stores data into local file with name specified.

### Save in storage as
Stores data into web storage with name specified.

### Save as template
Stores data as template with name specified.

Make a template location through template dialog to store before you choose this.

### Open
Opens local file.

You can open local files by drag and drop.

### Open from storage
Opens file from web storage.

### Open from templates
Opens file from template location.
The file opened from the template can be over write by save command.

### New file
Creates new file.

### PDF export
Exports as PDF file and downloads it.

### PDF export in storage
Exports as PDF file and stores into web storage.

### Change canvas size
Changes canvas size of the current document.
You can draw out side of canvas which grid is not shown like drawing inside the grid.

### Solve overlapping
Removes overlapping stitches.

Removes completelly overlapping stitches and replaces multiple stitches which is shown like a single stitch.

### View and image save setting
Settings for data displayed in screen.

### Print setting
Settings for data printed and PDF export.

### Bounds setting
Settings for bounds for output.

### View setting
Changes view related settings such as cursor color.

### Metadata
Edit metadata.

### Edit shortcut keys
Edit shortcut keys.

Descriptions shown in menu and toolbar entries are updated after
 new window is opened.

### Help
Shows help page.

### Shortcut keys
Shows list of shortcut keys.

### About
Shows about Kogin.

## Top toolbar
Describes commands can be used through upper toolbar in the window.

### Menu
Shows dropdown menu.

### New file
Creates new file.

### Open file
Opens file.

### Save
Over writes file into existing file. If the file is not stored yet,
 opens dialog to save with name.

### Undo
Roll back one procedure.

### Redo
Proceed one procedure roll backed.

### Copy
Copies selected items.
You can not paste external software because the copying does not copy
 into system clipboard.
This limitation is caused by the security of the web browser.

### Cut
Cuts selected items.

### Paste
Pastes items copied or cut.
Once you choose paste, preview item is shown as template on the view, click place to paste where you
 want to place it.

### Template horizontal mirror
Mirrors current template horizontally.
Once you choose this, preview item is shown on the view, click place to paste where you
 want to place it.

### Template vertical mirror paste
Mirrors current template vertically.
Once you choose this, preview item is shown on the view, click place to paste where you
 want to place it.

### Template horizontal and vertical mirror
Mirrors current template both horizontally and vertically.
Once you choose this, preview item is shown on the view, click place to paste where you
 want to place it.

### Select
Selects items.
While drag cursor to select range, if moving cursor from left to right,
only whole item is inside range are selected.
If moving cursor from right to left, all items partially inside range are selected.

When you click item while pressing shift key, clicked items are added to the selection.

### Points select
Selects items range generated by multiple points.

### Click and delete
Deletes item where clicked.

### Template
Opens template dialog.

### Template history
Shows history of template used previouslly.
You can use template used recently again.

### Stitch 1
Draws one length stitch.

### Stitch 3
Draws three length stitch.

### Stitch 5
Draws five length stitch.

### Modoko frame
Draws specified size of modoko frame.

### Stitch 2
Draws two length stitch.

### Stitch 4
Draws four length stitch.

### Stitch 6
Draws six length stitch.

### Katako frame
Draws specified size of katako frame.

### Stitch N
Draws over seven length stitch.

### X
Draws X pattern in stitch length of 2.

### V
Draws V pattern in stitch length of 2.

### Reversed V
Draws reversed V pattern in stitch length of 2.

### Switch to next pivot
Switches pivot which changes position for inserting template.
Works only templates which has pivots defined.

### Color
Changes color of stitches.

### Move selected
Moves selected items.

### Make array
Copies selected items into array.

### Group
Makes selected items as a group.

### Ungroup
Dissolve selected group into items.

### Insert pivot
Inserts pivot which prepares template position.

### Delete pivot
Deletes pivot which prepares template position.

## Bottom toolbar
Describes commands can be used through lower toolbar in the window.

### Layer lock state
Changes lock state for current layer.
You can not edit locked layer.

### Layer visibility
Changes visibility for current layer.
Invisible layer is not shown and items on the hidden layer are not possible to modify.

### Layer
Switches layer to edit.

### Layer menu
There are menu to add layer or to remove layer.

### Switch view mode
Changes way to show stitches.

### Grid
Switches visibility of the grid.

### Crosshair
Switches visibility of the crosshair cursor.

### 1 to 1 line
Switches visibility of the 1:1 angled cursor.
1:1 cursor matches side of modoko frames.

### 1 to 2 line
Switches visibility of the 1:2 angled cursor.
1:2 cursor matches side of katako frames.

### Output bounds
Specifies range to show when file stored.

### Zoom in
Zoom in.

### Zoom out
Zoom out.

### Zoom reset
Changes back to 100% zoom.

### To front
Moves selection to front.

### To front one level
Moves selection to front one level.

### To back one level
Moves selection to back one level.

### To back
Moves selection to back.

### Coordinate
Shows cursor position.

### Local coordinate
Shows cursor position in local coordinate.
You can set local origin by pressing space key (default key setting).

This function is useful to count size of frame.

### Notice
Switchs visibility of some notices.
This button is used by to sign in web storage.

## Image save setting
Changes settings for edit view and save data.

### Use xlink
If you want to read SVG file into Inkscape, enable this option.

### Monochrome
Stores file as monochrome image.

### Background color
Choose this when you need background color. If you unselect this option,
 background is transparent.
Input background color in hexadecimal color code.

### Margin
When stores data as image, adds margins specified around pattern.
Input margin as number of grid for each sides.

### Over grid.
Choose this if you want to show grid lines over stitches.

### Horizontal count
Horizontal count of grid shown in the view to edit.

### Vertical count
Vertical count of grid shown in the view to edit.

### Width
Width of one grid.

### Height
Height of one grid.

### Line color
Color of grid.

### Major line color
Color of major line of the grid.

### Major line frequency
When this vale is 0, no major line is shown.

### Line grain line width
Width of stitches shows stitch as a line.

### Overgrain line width
Width of stitches shows stitch as a line over grain.

### Overwarp line width
Width of stitches shows stich as a line over warp.

### Overgrain offset ratio
Ratio of stitches shows stitch as a line over grain in width of grid.

### Overwarp offset ratio
Ratio of stitches shows stitch as a line over warp in width of grid.

## Print setting
Changes settings for printing data. This setting is applied to PDF export.

### Use xlink
If you want to read SVG file into Inkscape, enable this option.

### Monochrome
Stores file as monochrome image.

### Background color
Choose this when you need background color. If you unselect this option,
 background is transparent.
Input background color in hexadecimal color code.

### Margin
When stores data as image, adds margins specified around pattern.
Input margin as number of grid for each sides.

### Show grid
Choose this if you need grid is shown.

### Over grid.
Choose this if you want to show grid lines over stitches.

### Width
Width of one grid.

### Height
Height of one grid.

### Line color
Color of grid.

### Major line color
Color of major line of the grid.

### Major line frequency
When this vale is 0, no major lines are shown.

### Show major line
Choose this if you need major lines are shown.

### Outer frame
Choose this if you need outer frame is shown.

### Major vertical offset
Moves first major line horizontally.

### Major horizontal offset
Moves first major line vertically.

### Line grain line width
Width of stitches shows stitch as a line.

### Overgrain line width
Width of stitches shows stitch as a line over grain.

### Overwarp line width
Width of stitches shows stich as a line over warp.

### Overgrain offset ratio
Ratio of stitches shows stitch as a line over grain in width of grid.

### Overwarp offset ratio
Ratio of stitches shows stitch as a line over warp in width of grid.

## View setting
Specifies setting such as cursor color.

### Selection color
Specify selection color in hexadecimal color.

### Cursor color
Specify cursor color in hexadecimal color.

### Overlay stitch color
Specify stitch color for preview in hexadecimal color.

### Pivot color
Specify pivot color in hexadecimal color.

### Show Kogin tool
Shows 1 stitch, three stitch, 5 stitch and modoko frame entries
 in the top toolbar.
If you disable this entries, they are shown in N stitch dropdown.

### Show Hishi tool
Shows 2 stitch, 4 stitch, 6 stitch and katako frame entries
 in the top toolbar.
If you disable this entries, they are shown in N stitch dropdown.

### Open from toolbar
Specifies location opens from open button in the top toolbar.

### Save from toolbar
Specifies location opens from save button in the top toolbar.

## Metadata
Input information of the pattern.
If you save these values as default, new document is filled with
 these values automatically, except creation date.

### Title
Title of this pattern. This is shown in the list of template and
 can be filtered.

### Title (English)
Title of this pattern in English. This is shown in the list of template and
 can be filtered.
Modoko like term could be easily filtered if written in English title.

### Creation date
Date of creation of this pattern. Creation date is automatically inserted
 when the document is created.

### Author
Author of this pattern.

### License
License of this pattern.

### Keywords
Keywords of this pattern. Multiple keywords could be separated by commas.

### Description
Description of this pattern.

### Version
Version of this pattern.

### Copyright
Copyright of this pattern.

### Type
Type of this pattern.

### Save as default
Saves this metadata as default. Default metadata is inserted when
 new document is created.

## Array
Duplicates selection into two dimensional array.

### Horizontal count
Input number of duplicate items horizontally.

### Vertical count
Input number of duplicate items vertically.

### Horizontal spacing
Input horizontal spacing for horizontal duplication.

### Vertical spacing
Input vertical spacing for vertical duplication.

### Horizontal offset
Input horizontal movement for vertical duplication.

### Vertical offset
Input vertical movement for horizontal duplication.

### Make group
Makes group for duplicated items.

## PDF export
Exports pattern as PDF file.
Print setting is used to define such as size of stitch in paattern.

### File name
Input file name for pattern to download.
When you store result into web storage, file dialog is opened before this dialog.

### Use bounds
Choose this if you need specify output range.

### Grid number
Choose this if you need numbering around grid.

### Paper size
Choose paper size.

### Landscape
Choose this if you use the paper in landscape direction.

### Margin
Input margin around the paper.

If you need title inserted, keep wide margin for top of the paper.

### Font (Desktop application)
Choose fonts for multibyte characters.

## Template dialog
You can choose template and manage templates in this dialog.

Double click on the preview in the templates to use on the document.
If you press Ctrl key while double click, the selected template is copied.

### Filter
There is filter to limit templates shown in the
 list of templates.
The filter is applied to file name, title and
 English title, and templates shown if filter matches one of them.

If filter is empty, all templates are shown.

### Preview size
You can change size of template preview.

### Add location
Adds location to load templates from.
Once you add new location, list of templates loaded from the
 location is shown in its tab.

Local is location from local storage. You can add templates
 from folder icon on location tab.
Local data is stored in the database of your web browser.

Github location requires user and repository to load.
Template data is cached into dedicated local storage.
You can specify its subdirectory.

Gitlab location requires its project ID to load.
Template data is cached into dedicated local storage.
You can specify its subdirectory.

Google Drive location requires its folder.

Dropbox location requires its folder.
This can be used if authorized by Dropbox.

### Reload
Reload all tabs.

### Keep color
Choose this if you want to insert template
 with the colors used in the template.
If this checkbox is not choosen,
 the template is inserted with the color
 selected on the top toolbar.

### Choose
Closes the dialog with selected template is going to be inserted.

### Copy
Copies selected template.

### Close
Closes the dialog to back to edit view.

## Location menu
Dropdown menu for each tabs can be used as follows.

### Reload
Reloads contents of this location.

### Rename
Renames tab.

### Download (Web application)
Downloads whole contents of this location at a time.

### Open folder (Desktop application)
Opens folder that template files are stored.

### Clear
Make local storage empty. This entry can be used only for local location.

### Remove
Removes this location.

### Move to left
Moves this tab to left.

### Move to right
Moves this tab to right.

### Information
Shows information about this location. Both list of files having no pivots and
 list of repeated files are shown also.

## Template menu
Dropdown menu opens through down arrow on template preview.

### Edit
Opens this template to edit.
You can over write template after edit it.
But you can not write to data on the web repository.
Store modified data into somewhere else.

### Reload
Reloads this template.
If you want to reload template if you edit it in this document or another document.

### Rename
Renames this template.

### Download
Downloads data of this template.

### Remove
Removes this template.
If template is not possible to edit on the web,
 the removed template is shown again by reloading.
