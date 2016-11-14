

var theNanobar;
var SELECTED_FILE = '';
var OUTPUT_FOLDER = '';


$(document).on('change', '.btn-file :file', function() {
  var input = $(this),
      numFiles = input.get(0).files ? input.get(0).files.length : 1,
      label = input.val().replace(/\\/g, '/').replace(/.*\//, '');
  input.trigger('fileselect', [numFiles, label]);
});

$(document).ready( function() {

    $('.btn-file :file').on('fileselect', function(event, numFiles, label) {

        var input = $(this).parents('.input-group').find(':text'),
            log = numFiles > 1 ? numFiles + ' files selected' : "/"+label;

        if( input.length ) {
            input.val(log);
        }
    });
});

$(document).ready(start)

var STEPS_ACTIVATION = {
  "one" : true,
  "two" : false,
  "three" : false
}

function start()
{
  setLoader();
  setStatus();
}





function updateSelectedFiles()
{
  var file_path = $('#fileLoader').val();
  alert(file_path);
  
  var file_name = file_path.substring(file_path.lastIndexOf("/")+1, file_path.length);

  $('#panelInputHeading').html(file_name+' artboards')
  // CALL NODE PROCESS

  s2f.inspectSketch(
    file_path,
    function(data_obj)
    {
      var ARTBOARDS = [];

      for (var p in data_obj['pages'])
      {
        var page = data_obj['pages'][p];
        for (var ab in page.artboards)
        {
          ARTBOARDS[page.artboards[ab].name] =  {};
        }
      }

      var ht = '<div class="form-group"><ul class="list-group row">';
      var ct = 0;
      for (var ab in ARTBOARDS)
      {
        ht+= "<li class='artboardItem list-group-item col-xs-6'><label><input type='checkbox' id='artboard_"+ab+"' value='"+ab+"' checked> "+ab+"</label></li>";
      }
      ht+="</ul></div>"
      $('#selectArtboards').html(ht);
    }
  )
  STEPS_ACTIVATION['two'] = true;
  SELECTED_FILE = file_path;
  setStatus();
}

    function updateOutputFolder()
    {
      var folder_path = $('#fileOutput').val();
      OUTPUT_FOLDER = folder_path;

      STEPS_ACTIVATION['three'] = true;
      setStatus();
    }

    function openInputFileDialog()
    {

      $('#fileLoader').click();

    }

    function setStatus(path)
    {
      for (var i in STEPS_ACTIVATION)
      {
        var opacity = STEPS_ACTIVATION[i] ? 1 : .3
        $("#step_"+i).children().prop('disabled',STEPS_ACTIVATION[i]);
        $("#step_"+i).css({opacity:opacity});
      }
    }

    var __dirname = path.dirname(document.currentScript.src.slice(7));


    function runS2F ()
    {
      startLoader();

      var artboards = [];




      $('#selectArtboards :checked').each(function() {
        artboards.push($(this).val());
      });

      var flags = {
        runinBackground : ($('#runConstant').is(':checked')),
        artboards       : artboards
      }

      $("#runButton").text("running...");
      $("#runButton").prop("disabled", true);



      var execPath = join(__dirname, '../', 'bin');
      execPath = join(execPath, "node")

      var args = [
        join(__dirname, '../', 'asyncS2F.js'),
        "--inputFile="+SELECTED_FILE,
        "--outputFolder="+OUTPUT_FOLDER,
        "--artboards=" +artboards.join(","),
        "--sim=false "
      ]

      var e = spawn(
        execPath,
        args
      );

      e.stdout.on('data',
        function(data){
          var cm = data.toString().split("|");
          if (cm.length > 0)
          {
            if (cm[0]=='P')
            {
              onProgress(Number(cm[1]), Number(cm[2]))
              return;
            }
          }
          console.log("DATA RECEIVED " + data.toString());

      });

      e.stderr.on('data',
        function (data) {
          console.log('err data: ' + data.toString());
        }
      );

      e.on('exit',
        function(code){
          resetRunButton();
        }
      );

    }


    var STO = null;

    function resetRunButton()
    {

      $("#runButton").prop("disabled", false);
      $("#runButton").text("Run");

    }


    function onProgress(current, total)
    {
      var pc = Math.round(current/total*100);
      tlPc = current/total;
      var progressBarWidth =pc*$("#pbar_container").width()/ 100;
      $("#pbar").width(progressBarWidth).html(pc + "% ");
    }


function startLoader()
{
  $('#progressBar').show();
  $('#framer1').hide();
  $('#framer2').hide();
  $('#framer2b').hide();

  $('#framer3').hide();
  $('#framer3b').hide();

  $('#framer3b_copy').hide();
  $('#framer3_straight').hide();
  $('#framer3_folded').hide();
}

var tl;
var tlPc = 0;

function setLoader()
{
  tl = new TimelineMax({paused:true});
  tl.insert(TweenLite.fromTo("#sketchIn01", 2, {drawSVG:"0% 100%"}, {drawSVG:"50% 50%"}));
  tl.insert(TweenLite.fromTo("#sketchIn02", 2, {drawSVG:"0% 100%"}, {drawSVG:"50% 50%"}));
  tl.insert(TweenLite.fromTo("#sketchIn03", 2, {drawSVG:"0% 100%"}, {drawSVG:"50% 50%"}));
  tl.insert(TweenLite.fromTo("#sketchIn04", 2, {drawSVG:"0% 100%"}, {drawSVG:"50% 50%"}));

  tl.add(TweenMax.fromTo("#sketchOut", .5, {display:''}, {fill:'rgba(25, 68, 124, 1)', stroke:'rgba(25, 68, 124, 1)',immediateRender:false, morphSVG:"#framer1"}));

  tl.add(TweenMax.fromTo("#framer2",.5, {display:''}, {immediateRender:false, morphSVG:"#framer2b"}))
  tl.add(TweenMax.fromTo("#framer3",.5, {display:''}, {immediateRender:false, morphSVG:"#framer3b"}))

  var tl2 = new TimelineMax();

  tl2.insert(TweenMax.fromTo("#framer3", .15, {divisplay:''}, {immediateRender:false, morphSVG:"#framer3_straight"}));
  tl2.insert(TweenMax.fromTo("#framer3b_copy",.5, {display:''}, {stroke:'rgba(255, 255, 255, .6)', fill:'rgba(255, 255, 255, .6)', immediateRender:false, morphSVG:"#framer3_folded"}));


  tl.add(tl2)
}
