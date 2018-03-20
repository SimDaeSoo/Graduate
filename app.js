// a simple node app for kakao api
var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var mysql = require('mysql');
var mecab = require('mecab-ffi');

var client = mysql.createConnection({
    hostname : "127.0.0.1:3306",
    user : "root",
    password : "a123123",
    database : "sys"
});

app.use(bodyParser.json());


app.get('/keyboard',function(req,res){ // setting keyboard for first open
  let keyboard = {
    "type" : "text"
    /*
    or button, like this
    "type" : "buttons",
    "buttons" : ["btn 1", "btn 2", "btn 3"]
    */
  };
  res.send(keyboard);
});

app.post('/message', function(req,res){
  let user_key = decodeURIComponent(req.body.user_key); // user's key
  let type = decodeURIComponent(req.body.type); // message type
  let content = decodeURIComponent(req.body.content); // user's message
  var toStringRes = "";
  console.log('req : '+req);
  console.log('user_key : '+user_key);
  console.log('type : '+type);
  console.log('input : '+content);

  mecab.extractNounMap(content, function(err, result) {

    for( var key in result ) {
      toStringRes += key + '['+result[key]+'] ';
    }
    console.log('res : '+toStringRes);

    let answer = {
      "message":{
        "text":"명사분석 결과 : "+toStringRes // in case 'text'
      }
    }
    res.send(answer);
  });
  /*
  answer can use
  {
    "message": {
      "text": "귀하의 차량이 성공적으로 등록되었습니다. 축하합니다!",
      "photo": {
        "url": "https://photo.src",
        "width": 640,
        "height": 480
      },
      "message_button": {
        "label": "주유 쿠폰받기",
        "url": "https://coupon/url"
      }
    },
    "keyboard": {
      "type": "buttons",
      "buttons": [
        "처음으로",
        "다시 등록하기",
        "취소하기"
      ]
    }
  }
  */
});

var paragraph ='마이크로소프트(MS)가 개발한 운영체제(OS) 최신 버전 ‘윈도우 10’의 무료 업그레이드가 29일부로 종료된다.';

app.listen(8080,function(){
  console.log('Connect 8080 port!');

  client.query('SELECT * FROM sys_config',function(err,res){
    if(err) throw err;
    var msg = res[0].variable;
    console.log("테스트 : " + msg);
  });
});
