
// SketchToFramer Node module

var sketch = require('sketchjs_with_sketchtool3.4');
var fs = require('fs');
var xml2js = require('xml2js');
var argv = require("yargs").argv;
var JSONPath = require('jsonpath')
var EventEmitter = require('events').EventEmitter;
var async = require('async');



var S2F =  {

  ORIGINAL_JSON : {},
  ORIGINAL_SVG : {},
  // CURRENT_ARTBOARD_JSON : {},
  FILES_EXPORTED : [],
  IMAGES_TO_EXPORT : [],
  OUTPUT_FOLDER : '',
  // CURRENT_ARTBOARD : '',
  ARTBOARDS_TO_EXPORT : [],
  SVG_DEFS : {},
  INPUT_FILE : null,
  WORKING_FOLDER : null,
  OUTPUT_FILE : null,
  FLAGS_OBJ : {},
  DONE_CBACK : null,
  PARSER_PREFIX : '#name',
  PARSER_COUNTER : 0,
  PROGRESS_CBACK : null,
  PROCESS_TOTAL : 0,
  TMP_COUNTER : 0,
  TIME_INIT : null,
  EVENT_EMITTER : null,


  inspectSketch : function(_file_name, _callback)
  {
    sketch.list(
      _file_name,
      'artboards',
      function(_data) {
        _callback(JSON.parse(_data));
      }
    )

  },


  run  : function (_inputFile, _outputFolder, _flagsObj, _cback, _progresscback, _sim)
  {

    if (_sim)
    {
      _inputFile ='/Users/jordi/Documents/TMA/GITHUB/testing s2f/s2f.framer/fromSketch/activityCard.sketch';
      _outputFolder = '/Users/jordi/Documents/TMA/GITHUB/testing s2f/s2f.framer/fromSketch/';

      _flagsObj = {
        runinBackground : false
      };
    }


    this.OUTPUT_FOLDER        = _outputFolder+"/";
    this.INPUT_FILE           = _inputFile;
    this.OUTPUT_FILE          = _inputFile.substring(_inputFile.lastIndexOf('/')+1, _inputFile.length-6) + "json";
    this.FLAGS_OBJ            = _flagsObj;
    this.ARTBOARDS_TO_EXPORT  = _flagsObj.artboards || [];
    this.DONE_CBACK           = _cback || function(){console.log("DONE!");};
    this.PROGRESS_CBACK       = _progresscback || function(_pc) { console.log("processing "+_pc);}
    this.EVENT_EMITTER        = new EventEmitter()

    this.TIME_INIT = new Date().getTime();

    this.EVENT_EMITTER.on('progress', this.PROGRESS_CBACK)
    this.EVENT_EMITTER.on('done', this.DONE_CBACK)


    this.start();

  },


  start : function ()
  {
    async.waterfall(
    [
      function (callback) {
          this.createJSON(this.INPUT_FILE, callback)
      }.bind(this),

      function (doc, callback) {
        this.ORIGINAL_JSON = JSON.parse(doc)
        this.createSVG(this.INPUT_FILE, this.OUTPUT_FOLDER, callback)
      }.bind(this),

      function (files, callback)
      {
        this.readSVG(files, callback)
      }.bind(this),

      function (callback)
      {
        this.startParsing(callback)
      }.bind(this),

      function (_data, callback)
      {
        // this.EVENT_EMITTER.emit('progress', 1, 1)
        this.saveAndCleanFiles(_data, callback)
      }.bind(this)
    ],
    function (err, c) {
      if (err)
      {
        console.log("ERROR!");
        console.log(err);
      }
      this.EVENT_EMITTER.emit('done')
    }.bind(this)
    );
  },


  createJSON : function (_file, _callback)
  {
    console.log("DUMPING");
    sketch.dump(
      _file,
      function(err, doc){
        _callback(err, doc)
      }
    );
  },

  createSVG : function (_file, _outputFolder, _callback)
  {
    console.log("create SVG");
    var opt = {
      type : 'artboards',
      formats : 'svg',
      output : _outputFolder,
      scales : '1'
    };

    if (this.ARTBOARDS_TO_EXPORT.length>0) opt.items = this.ARTBOARDS_TO_EXPORT

    sketch.export(
      _file.replace(/(\s)/, "\\ "),
      opt,
      function(err, stdout, stderr) {
        var files = stdout.split("\n");
        _callback(err, files);
      }
    )
  },



  readSVG : function (_files, _callback)
  {
    console.log("read SVG");
    var parser = new xml2js.Parser(
      {
        explicitChildren  : true,
        childkey          : 'children',
        attrkey           : 'attr',
        preserveChildrenOrder : true
      }
    );

    async.each(

      _files,

      function(_f, _callback)
      {
        if (_f == '') {
          _callback(null);
          return
        }

        if (_f.indexOf('d ')>-1) _f = _f.substring(_f.indexOf('d ')+2, _f.length)

        var file = this.OUTPUT_FOLDER + _f
        var artboard_name = file.substring(this.OUTPUT_FOLDER.length, file.indexOf(".svg"))

        this.FILES_EXPORTED[artboard_name] = file

        var data = fs.readFileSync(file, 'utf8');

        parser.parseString(
          data,
          function(err, results)
          {
            this.ORIGINAL_SVG[artboard_name] = results
            _callback(err, results);
          }.bind(this)
        )
      }.bind(this),

      function(err)
      {
        _callback(err)
      }
    )
  },



// --------------------------------------------------------------------



  startParsing : function(_callback)
  {
    console.log("start Parsing");
    var data = this.ORIGINAL_JSON;

    // var pages = data.pages['<items>'];
    var pages = data.pages;



    var outJSON = {}
    outJSON.pages = {};


    async.forEach(

      pages,

      function (_page, _callback) {

        var pageName = this.desanitizeId(_page.name);

        this.parsePage(_page, function(data){

          outJSON.pages[pageName] = data

          _callback();
        })

      }.bind(this),

      function(err) {

        _callback (err, outJSON)
      }
    )
  },



  saveAndCleanFiles : function(_data, _callback)
  {

    for (var _i in this.ORIGINAL_SVG)
    {
      var _fpath = this.OUTPUT_FOLDER+_i+'.svg';
    //   fs.unlinkSync(_fpath);
    };


    var _out_data = JSON.stringify(_data, null, '\t');

    fs.writeFile(
      this.OUTPUT_FOLDER+this.OUTPUT_FILE,
      _out_data,
      function (err)
      {
        var end_time= new Date().getTime();
        var totalTime = end_time - this.TIME_INIT
        console.log("time : " + totalTime + "ms");
        _callback(err, this.OUTPUT_FOLDER+this.OUTPUT_FILE)
      }.bind(this)
    );
  },

// --------------------------------------------------------------------



  parsePage : function (_page_data, _callback)
  {


    var layers = this.getChildrenLayers(_page_data);
    // console.log("LAYERS : " + layers)
    // COUNT CHILDREN
    this.PARSER_COUNTER = this.TMP_COUNTER = this.PROCESS_TOTAL = 0;
    for (var l in layers)
    {
      if (layers[l]['<class>'] != 'MSArtboardGroup') continue;
      if (this.ARTBOARDS_TO_EXPORT.length == 0 || this.ARTBOARDS_TO_EXPORT.indexOf(layers[l].name) > -1)
      {
        var _query  = "$..*[?(@.id=='"+layers[l].name+"')]";
        var _res    = JSONPath.parent(
          this.ORIGINAL_SVG[layers[l].name],
          _query
        );
        this.PROCESS_TOTAL = this.countChildren(_res.children)
      }
    }

    // START PARSEING ARTBOARDS
    var artboards_arr = {};

    async.forEachOf(
      layers,

      function (layer, key, callback) {

        var artboard_id = layer.name

        if (layer['<class>'] != 'MSArtboardGroup' || (this.ARTBOARDS_TO_EXPORT.length > 0 && this.ARTBOARDS_TO_EXPORT.indexOf(artboard_id) <0)) {
          callback();
          return;
        }

        // var artboard_json = this.ORIGINAL_JSON.pages['<items>'][0].layers['<items>'][key]
        var artboard_json = this.ORIGINAL_JSON.pages[0].layers[key]

        this.parseArtboard(layer, artboard_id, artboard_json, function(_data){
          artboards_arr[artboard_id] = _data
          callback();
        })

      }.bind(this),
      function(err)
      {
        _callback(artboards_arr);
      }
    )

  },




  parseArtboard : function (_data, _artboard_id, _json_data, _callback)
  {

    var artboard_data = {
      id      : _data.name,
      frame   : this.getFrameInfo(_data.frame),
    };

    artboard_data.x = artboard_data.y = 0;

    if (_data.hasBackgroundColor)
      artboard_data.backgroundColor = _data.backgroundColor.value;
    else
      artboard_data.backgroundColor = 'transparent';

    var _node = this.ORIGINAL_SVG[artboard_data.id]['svg'];

    if (_node.defs)
      artboard_data.defs = this.getDefsInfo(_node.defs, _artboard_id);

    var _query  = "$..*[?(@.id=='"+artboard_data.id+"')]";
    var _res    = JSONPath.parent(
      this.ORIGINAL_SVG[artboard_data.id],
      _query
    );


    this.parseChildrenNodes(_res.children, artboard_data, _json_data, _artboard_id, function(_data){

      artboard_data.children = _data
      _callback(artboard_data)
    });

  },





  countChildren : function (_data_arr)
  {
    for (var i in _data_arr)
    {
      var type = _data_arr[i][this.PARSER_PREFIX];

      switch (type) {
        case 'g':
        case 'rect':
        case 'text':
        case 'image':
          this.TMP_COUNTER++
          break;

        default:
          _data_arr[i].children = null;
      }

      if (_data_arr[i].children) this.countChildren(_data_arr[i].children);
    }

    return this.TMP_COUNTER;
  },


  parseChildrenNodes : function(_data_arr, _pater, _json_data, _artboard_id, _callback)
  {

    var children = [];

    async.each(

      _data_arr,

      function(data, callback) {

        var obj   = {}
        var type  = data[this.PARSER_PREFIX];

        obj.id    = data.attr.id
        obj.type  = type

        switch (obj.type) {

          case 'g':
            obj = this.getGroupNodeInfo(data, _pater.id, _json_data);
            break;

          case 'rect':
            obj.type            = 'layer';
            obj.id              = data.attr.id;
            obj.frame           = this.getFrameInfo(data.attr);
            obj.backgroundColor = data.attr.fill || _pater.attr.fill;
            break;

          case 'text':
            obj       = this.getTextInfoFromJSON(data.attr.id, _artboard_id, _json_data);
            obj.type  = 'text';
            obj.id    = data.attr.id;
            data.children = null;
            break;

          case 'path':
          case 'use':
          case 'polyline':
          case 'polygon':
            var svgContent  = this.getSVGContent(data);
            if (!_pater.svgContent) _pater.svgContent = [];
            _pater.svgContent.push(svgContent);
            obj = null;
            break;



          case 'image':
             obj  = this.getImageFromSVG(data, _artboard_id);
            break;

          default:
            obj = null
            data.children = null;
        }

        if (obj == null) {
          callback()
          return
        }

        this.PARSER_COUNTER++;
        this.EVENT_EMITTER.emit('progress', this.PARSER_COUNTER, this.PROCESS_TOTAL);

        if (data.attr.mask)
          obj.mask = this.getMaskInfo(data, _artboard_id);

        obj.fx = this.getFiltersInfo(data, obj.type, _pater.id, _json_data)

        children.push(obj)

        if (data.children != null)
        {

          this.parseChildrenNodes(data.children, obj, _json_data, _artboard_id, function(_data) {
            obj.children = _data;
            callback();
            // return
          })
        } else {

          callback()
          return
        }

      }.bind(this),
     function(err)
      {
        _callback(children)
      }
    )
  },





// -------------------------------------

  getFiltersInfo : function (_node_data, _layer_type, _pater_id, _json_data)
  {
    var _id = _node_data.attr.id;

    if (_id == undefined) return null;

    _id = this.desanitizeId(_id);

    var fx = {};
    var res = this.findNode(_id, _pater_id, _json_data);

    var _i, _tmp_info;

    if (res.style.fills.length > 0)
    {
      var _fills    = [];
      _tmp_info  = res.style.fills;
      for (_i in _tmp_info)
      {
        if (!_tmp_info[_i].isEnabled) continue;

        _fills.push({
          color : _tmp_info[_i].color.value
        })
      }

      fx["fills"] = _fills;
    }

    if (res.style.colorControls.isEnabled)
    {
      _tmp_info = res.style.colorControls;

      fx["colorControls"] = this.extractProperties(_tmp_info, ["brightness", "saturation", "contrast", "hue"]);
    }


    if (res.style.contextSettings.opacity != 1)
      fx["opacity"] = {
        value       : res.style.contextSettings.opacity
      }

    if (res.style.contextSettings.blendMode != 0)
      fx["blendMode"] = {
        value       : res.style.contextSettings.blendMode
      }


    if (res.style.blur.isEnabled)
      fx["blur"] = {
        value       : res.style.blur.radius
      }

    if (res.style.shadows.length > 0)
    {
      var shadows = [];
      _tmp_info = res.style.shadows;

      for (_i in _tmp_info)
      {
        if (!_tmp_info[_i].isEnabled) continue;

        var _shadow_type = (_layer_type == 'text')? 'text-shadow' : 'box-shadow';

        var _shadow = this.extractProperties(
          _tmp_info[_i],
          ["color.value", "offsetX", "offsetY", "blurRadius", "spread"]
        );

        _shadow.type = _shadow_type

        shadows.push(_shadow);
      }
      fx["shadows"] = shadows;
    }


    if (res.style.innerShadows.length > 0)
    {
      var shadows = [];
      _tmp_info = res.style.innerShadows;

      for (_i in _tmp_info)
      {
        if (_tmp_info[_i].isEnabled) continue;

        var _shadow_type = (_layer_type == 'text')? 'text-shadow' : 'box-shadow';
        var _shadow = this.extractProperties(
          _tmp_info[_i],
          ["color.value", "offsetX", "offsetY", "blurRadius", "spread"]
        );

        _shadow.type = _shadow_type;

        shadows.push(_shadow);
      }

      fx["innerShadows"] = shadows;
    }




    if (res.style.borders.length > 0)
    {
      var borders = [];
      _tmp_info = res.style.borders;

      for (_i in _tmp_info)
      {
        if (!_tmp_info.isEnabled) continue;

        var _border = this.extractProperties(
          _tmp_info[_i], ["thickness", "color.value", "position"]
        );
        _border.radius = _node_data.attr.rx;

        borders.push(border);
      }

      fx["borders"] = borders;
    }

    return fx;

  },


  getTextInfoFromJSON : function(_node_id, _pater_id, _json_data)
  {
    var _id = this.desanitizeId(_node_id);
    var _res = this.findNode(_id, _pater_id, _json_data);

    // console.log("DATA : ");
    // console.log(_json_data);
    // console.log("GET TEXT INFO FOR " + _node_id + " | " + _pater_id)

    // console.log("RES ")


    var text_obj = {
      frame     : this.getFrameInfo(_res.frame)
       ,allText  : _res.attributedString.value.text.split(" ").join("&nbsp;")
      ,parts    : []
    };



    for (var _i in _res.attributedString.value.attributes)
    {
      var _part = _res.attributedString.value.attributes[_i];

      text_obj.parts.push(
        {
          color       : _part.NSColor.color
          ,alignment  : _part.NSParagraphStyle.style.alignment
          ,lineSpacing: _part.NSParagraphStyle.style.maximumLineHeight
          ,fontFamily : _part.NSFont.family
          ,fontName   : _part.NSFont.name
          ,fontSize   : _part.NSFont.attributes.NSFontSizeAttribute
          ,startIndex : _part.location
          ,text       : _part.text.split(' ').join("&nbsp")
        }
      );
    }

    return text_obj;
  },


  getImageFromSVG : function(_node_data, _artboard_id)
  {

    return {
      id      : _node_data.attr.id
      ,frame  : this.getFrameInfo(_node_data.attr)
      ,type   : 'image'
      ,image  : this.extractImage(_node_data, _artboard_id)
    }
  },



  getGroupNodeInfo : function (_group_data, _pater_id, _json_data)
  {
    var _groupId = this.desanitizeId(_group_data.attr.id);
    var groupObj = {
      id    : _groupId,
      type  : 'layer',
      attr  : _group_data.attr
    };

    var _res = this.findNode(_groupId, _pater_id, _json_data);



    if (_res.frame)
      groupObj.frame = this.getFrameInfo(_res.frame);

    return groupObj;
  },



  getFrameInfo : function(_attr_data)
  {
      return {
        x         : Number(_attr_data.x),
        y         : Number(_attr_data.y),
        width     : Number(_attr_data.width),
        height    : Number(_attr_data.height)
      }
  },



  getDefsInfo : function(_defs_data, _artboard_id)
  {
    _defs_data = _defs_data[0];

    var defsObj = {};

    if (_defs_data.children)
    {
      for (var _d in _defs_data.children)
      {
        var _svgElement = this.getSVGContent(_defs_data.children[_d]);
        _svgElement.type = _defs_data.children[_d][this.PARSER_PREFIX];
        _svgElement.id = _artboard_id+"_"+_svgElement.id
        defsObj[_artboard_id+"_"+_svgElement.id] = _svgElement;

        if (_defs_data.children[_d].children)
        {
            defsObj[_artboard_id+"_"+_svgElement.id].children = [];


            for (var _dd in _defs_data.children[_d].children)
            {
                var _subSvgElement = this.getSVGContent(_defs_data.children[_d].children[_dd])
                _subSvgElement.type = _defs_data.children[_d].children[_dd][this.PARSER_PREFIX];                
                defsObj[_artboard_id+"_"+_svgElement.id].children.push(_subSvgElement);
            }
        }

      }
    } else
      defsObj = null;

    return defsObj;
  },



  getSVGContent : function (_svg_data)
  {

    var svgObj = _svg_data.attr;
    svgObj.type = _svg_data[this.PARSER_PREFIX];
    delete svgObj[this.PARSER_PREFIX];

    return svgObj;
  },


  getMaskInfo : function (_node_data, _artboard_id)
  {
    var _mask_id = _node_data.attr.mask.substring(
      _node_data.attr.mask.indexOf("#")+1,
      _node_data.attr.mask.length-1
    );

    var _query  = "$..*[?(@.id=='"+_mask_id+"')]";
    var _res    = JSONPath.parent(this.ORIGINAL_SVG[_artboard_id], _query);

    var mask_obj ={
      id    : _mask_id
    }

    if (_node_data.attr.fill)
      mask_obj.fill = _node_data.attr.fill

    mask_obj.use  = _res.use[0].attr['xlink:href'];
    mask_obj.use  = mask_obj.use.substring(1, mask_obj.use.length);

    return mask_obj;
  },


  getChildrenLayers : function (_node_data)
  {
    if (_node_data.layers) return _node_data.layers;
    else return [];
  },



// ------------------------------------------------------------------------------------


  findNode : function (_node_id, _pater_id, _json_data)
  {
    var _query  = "$..*[?(@.name=='"+_node_id+"')]";
    var _res    = JSONPath.query(_json_data, _query);

    if (!_res.length)
    {
      var errorMsg = "Node not found! ["+_node_id+"] on ["+_pater_id+"]";
      throw new Error (errorMsg);
    }

    var node = null;

    if (_res.length > 1)
    {
      var _pQuery = "$..*[?(@.name=='"+_pater_id+"')]";
      var _pRes   = JSONPath.nodes(_json_data, _pQuery);
      for (var r in _pRes)
      {
        if (_pRes[r].value.name == _pater_id)
        {
          var _cRes = JSONPath.query(_pRes[r].value, _query);
          node = _cRes[0];
          break;
        }
      }
    } else
      node = _res[0];

    return node;
  },


  extractProperties : function(_obj, _props_arr)
  {
    var o = {}

    var _p;

    for (var _i in _props_arr)
    {
      _p = _i;
      if (_p.indexOf(".")) _p = _p.split(".")[0];
      o[_p] = _obj[_i];
    }

    return o;
  },


  extractImage : function(_node_data, _artboard_id)
  {
    var __keepURL = false;

    var image_obj = {
      frame     : this.getFrameInfo(_node_data.attr)
      ,id       : _node_data.attr.id
    };


    var _query    = "$..*[?(@.id=='"+image_obj.id+"')]"
    var _res      = JSONPath.parent(this.ORIGINAL_SVG[_artboard_id], _query);
    var _img_src  = _res.attr['xlink:href'];

    var _src = '';

    for (var _i in this.IMAGES_TO_EXPORT)
    {
      var _data_in_memory = this.IMAGES_TO_EXPORT[_i].src;
      if (_data_in_memory == _img_src) _src = this.IMAGES_TO_EXPORT[_i].file_name;
    }

    if (_src == '')
    {
      _src = this.createPNGFile(image_obj.id, _img_src);
      this.IMAGES_TO_EXPORT.push(
        {
          src         : _img_src
          ,file_name  : _src
        }
      );
    }
    image_obj.src = _src;

    return image_obj;
  },


  createPNGFile : function(_file_name, _raw_data)
  {
    var _imageBuffer = this.decodeBase64Image(_raw_data);
    var file = this.OUTPUT_FOLDER+_file_name+'.png';

    fs.writeFile(
      file,
      _imageBuffer.data,
      function(err) {
        if (err) throw new Error('Error creating PNG file')
      }
    );
    return file;
  },


  decodeBase64Image : function (_data_str)
  {
    var matches = _data_str.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/),
      response = {};

    if (matches.length !== 3) {
      return new Error('Invalid input string');
    }

    response.type = matches[1];
    response.data = new Buffer(matches[2], 'base64');

    return response;
  },


  desanitizeId : function (_str)
  {
    return _str.split("-").join(" ");
  }


}

if (argv.inputFile) {

  var inputFile     = argv.inputFile;
  var outputFolder  = argv.outputFolder;
  var artboards     = [];
  if (argv.artboards) artboards= argv.artboards.split(',');
  var sim           = (argv.sim=='true')

  var done_cback = function (){
    process.exit(0)
  }

  var progress_cback = function (c, t)
  {
    process.stdout.write("P|"+c+"|"+t);
  }

  S2F.run(
    inputFile,
    outputFolder,
    {
      artboards : artboards
    },
    done_cback,
    progress_cback,
    sim
  );
}

else
  process.stdout.write("EXECUTE AS MODULE");

module.exports = S2F
