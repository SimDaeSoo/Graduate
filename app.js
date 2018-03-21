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
    database : "qna"
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
  var system_mode;
  // console.log('req : '+req);
  // console.log('user_key : '+user_key);
  // console.log('type : '+type);
  // console.log('input : '+content);

  client.query('SELECT * FROM Sys_User WHERE user_key='+'\''+user_key+'\'',function(err,query_res){
    if(query_res.length==0){
      client.query('INSERT INTO Sys_User(user_key,sys_status) VALUES ('+'\''+user_key+'\''+',0)',function(err,query_res){
        system_mode = 0;
      });
    }else{
      system_mode = query_res[0].sys_status;
    }

    if(system_mode == 1){
      var temp_a = content.split("#A")[1];
      var temp_q = content.split("#A")[0];
      temp_q = temp_q.split("#Q")[1];
      if(temp_q != undefined){
        content = temp_q;
      }

      if(temp_q != undefined && temp_a != undefined){
        mecab.parse(temp_q, function(err, result) {
          var result_arr = [];
          var length = result.length;
          var index = 1;
          var Q_Type = '';
          var new_q_id = 0; // 비동기니까 잘 처리할 것.

          client.query('SELECT * FROM Count_Table',function(err,res){
            new_q_id = res[0].tot_q;

            console.log("New Q ID is a : " + new_q_id);

            for( var key in result ) {
              var Q_Arr = [];
              Q_Arr.push(new_q_id);
              Q_Arr.push(index++);
              Q_Arr.push(length);
              Q_Arr.push(result[key][0]);
              Q_Arr.push(result[key][1]);
              Q_Arr.push(result[key][2]);
              Q_Arr.push(result[key][3]);
              Q_Arr.push(1); // Search count 수.
              Q_Arr.push("Q"); // 의사소통 목적.

              result_arr.push(Q_Arr);
            }
            console.log(result_arr);
            // client.query('INSERT INTO Sys_User(user_key,sys_status) VALUES ('+'\''+user_key+'\''+',0)',function(err,query_res){
            // });
          });
        });

        mecab.parse(temp_a, function(err, result) {
          var new_a_id = 0; // 비동기니까 잘 처리할 것.

          client.query('SELECT * FROM Count_Table',function(err,res){
            new_a_id = res[0].tot_q;
            var A_Arr = [];
            A_Arr.push(new_a_id);
            A_Arr.push(temp_a);
            console.log(A_Arr);
            // client.query('INSERT INTO Sys_User(user_key,sys_status) VALUES ('+'\''+user_key+'\''+',0)',function(err,query_res){
            // });
          });
        });
      }
    }

    mecab.parse(content, function(err, result) {
      var new_q_id = 0; // 비동기니까 잘 처리할 것.
      //--------------------------------------------------------------------------------
      client.query('SELECT * FROM Count_Table',function(err,count_res){
        new_q_id = count_res[0].tot_q;
        if(system_mode == 2){
          for( var key in result ) {
            toStringRes += key + '['+result[key]+'] ';
          }
        }
        //--------------------------------------------------------------------------------
        if(content.split("#학습모드")[1] != undefined){
          system_mode = 1;
          client.query('UPDATE Sys_User SET sys_status=1 WHERE user_key='+'\''+user_key+'\'',function(err,res){
          });
        }else if(content.split("#명사분석")[1] != undefined){
          system_mode = 2;
          client.query('UPDATE Sys_User SET sys_status=2 WHERE user_key='+'\''+user_key+'\'',function(err,res){
          });
        }else if(content.split("#기본모드")[1] != undefined){
          system_mode = 0;
          client.query('UPDATE Sys_User SET sys_status=0 WHERE user_key='+'\''+user_key+'\'',function(err,res){
          });
        }
        //--------------------------------------------------------------------------------
        var answer;

        if(system_mode == 1){
          answer = {
            "message":{
              "text":"System - 학습모드" // in case 'text'
            }
          }
        }else if(system_mode == 2){
          answer = {
            "message":{
              "text":"명사분석 결과 : "+toStringRes // in case 'text'
            }
          }
        }else{
          answer = {
            "message":{
              "text":"대화 미구현" // in case 'text'
            }
          }
        }
        res.send(answer);
      });
    });
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

app.get('/home', function(req, res) {
  res.sendFile(__dirname + "/index.html");
});

app.listen(8080,function(){
  console.log('8080 포트 서버 연결 완료!.');
});
