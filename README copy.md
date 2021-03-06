# SketchToFramer

A node based app and a Framer module to recreate Sketch artboards in code.

##Execution
. CD to folder where asyncS2F.js exists
.  node asyncS2F.js --inputFile=/Users/martinej/Desktop/SoundStorm/screens/sketch/proto01b.sketch --outputFolder=/Users/martinej/Desktop/SoundStorm/Protos/proto01.framer/sketch


## Installation

Replace node_modules/sketchjs_with_sketchtool3.4/tools/bin/ with the files 
sketchmigrate
sketchtool
from /usr/local/bin after installing sketchtools from Sketch



* Download the the project on your computer
* Install the dependencies
```
npm install
```


## Description


SketchToFramer consists of two parts:

* **s2f.js** is a node app that will convert Sketch files into a JSON file and png files

* **SketchImporter.coffee** a Framer module that will read the generated JSON file and recreate the Sketch design in code


The objective is to be able to replicate Sketch designs in a reusable and code-base manner.



### s2f.js ###

  This node process will read the sketch file and convert it to JSON file. It will also export images as PNG when needed.

#### Usage ####
 node s2f.js
  * --input= sketchFile
  * --output= folder where to output
  * --artboards= list of *artboards* inside the sketch file to be exported (if empty, it will export all of them)

##### Example: #####
```
  node s2f.js --input=test/activityCard.sketch --output=test/s2f.framer/fromSketch/
```





### SketchImporter.coffee ###

This class will read a JSON file, look for the specified ArtBoard and recreate it.


#### Arguments: ####
* *file* = the location of the JSON file
* *page* = the page where the artboard to be recreated is
* *artboard* = the name of the artboard

I recommend creating classes for artboards so you can create shortcuts directly to layers you want to manipulate later

##### Example #####
```
{SketchImporter} = require 'SketchImporter'

class exports.ActivityCard extends Layer

  constructor : (obj = {}) ->

    super obj

    obj.file      = 'fromSketch/ActivityCard.json'
    obj.page      = 'Page 1'
    obj.artboard  = 'activityCard'

    @content = SketchImporter.import obj, @

    # this is a shortcut to change the title text
    # the original text style is applied to the new html

    @title_txt = @content.mod_info.txt_title

```

#### Supports: ####
* masks
* shadows
* font styles (only system fonts for now and limited family options, bascially only bold)
* fills
* SVG shapes will be rendered as SVG objects
* multiple styles on text 



## Watch outs: ##
For Sketch:
  * group everything you can. It makes it less prone to errors when parsing
  * layers/artboards/pages can't have '-' in their name
  * avoid naming layers as Framer properties ('image', 'x', 'y', 'backgroundColor', etc)

## To Do: ##

* fonts (no idea how to implement Bold, Thin, etc...)
* polish the gulp process
* special borders
* some other fx
