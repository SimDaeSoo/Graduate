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

    //--------------------------------------------------------------------------------------------------------------------------
    if(system_mode == 1){
      var temp_a = content.split("#A")[1];
      var temp_q = content.split("#A")[0];
      temp_q = temp_q.split("#Q")[1];
      if(temp_q != undefined){
        content = temp_q;
      }

      if(temp_q != undefined && temp_a != undefined){
        mecab.parse(temp_q, function(err, result) {
          var length = result.length;
          var index = 1;
          var Q_Type = '';
          var new_q_id = 0; // 비동기니까 잘 처리할 것.

          client.query('SELECT * FROM Count_Table',function(err,res){
            new_q_id = res[0].tot_q;

            console.log("New Q ID is a : " + new_q_id);
            var toQuery = "";

            for( var key in result ) {
              if(key == 0){
                toQuery += '(\''+new_q_id+'\'';
                toQuery += ',\''+index+'\'';
                index++;
                toQuery += ',\''+length+'\'';
                toQuery += ',\''+result[key][0]+'\'';
                toQuery += ',\''+result[key][1]+'\'';
                toQuery += ',\''+result[key][2]+'\'';
                toQuery += ',\''+result[key][3]+'\'';
                toQuery += ',\''+1+'\''; // Search count 수.
                toQuery += ',\''+"Q"+'\')'; // 의사소통 목적.
              }else{
                toQuery += ',(\''+new_q_id+'\'';
                toQuery += ',\''+index+'\'';
                index++;
                toQuery += ',\''+length+'\'';
                toQuery += ',\''+result[key][0]+'\'';
                toQuery += ',\''+result[key][1]+'\'';
                toQuery += ',\''+result[key][2]+'\'';
                toQuery += ',\''+result[key][3]+'\'';
                toQuery += ',\''+1+'\''; // Search count 수.
                toQuery += ',\''+"Q"+'\')'; // 의사소통 목적.
              }
            }
            console.log(toQuery);
            //id q_index q_length q_1 q_2 q_3 q_4 q_count q_type
            client.query('INSERT INTO Q_Table(id,q_index,q_length,q_1,q_2,q_3,q_4,q_count,q_type) VALUES '+toQuery,function(err,query_res){
            });
          });
        });

        mecab.parse(temp_a, function(err, result) {
          var new_a_id = 0; // 비동기니까 잘 처리할 것.

          client.query('SELECT * FROM Count_Table',function(err,res){
            new_a_id = res[0].tot_q;
            var toQuery = "";
            toQuery+='(\''+new_a_id+'\'';
            toQuery+=',\''+temp_a+'\')';
            console.log(toQuery);
            client.query('INSERT INTO A_Table(a_id,answer) VALUES '+toQuery,function(err,query_res){
            });
            new_a_id++;
            client.query('UPDATE Count_Table SET tot_q ='+new_a_id,function(err,query_res){
            });
          });
        });
      }
    }
    //--------------------------------------------------------------------------------------------------------------------------
    client.query('SELECT * FROM Q_Table',function(err,Table_res){
      mecab.parse(content, function(err, result) {
        var q_length = 0; // 비동기니까 잘 처리할 것.
        //--------------------------------------------------------------------------------
        client.query('SELECT * FROM Count_Table',function(err,count_res){
          q_length = count_res[0].tot_q;
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
          }else if(system_mode == 0){
            var Similarity = 0;
            var Similarity_Q_Id = 0;

            for(i=0;i<q_length;i++){
              var Temp_Union = 0;
              var TempIntersection = 0;

              for(j=0;j<result.length;j++){
                var key_word_simila = 0;
                var key_word_index = 0;

                for(k=0;k<Table_res.length;k++){
                  if(Table_res[k].id < i){
                    k += Table_res[k].q_length-1;
                  }else if(Table_res[k].id == i){
                    Temp_Union = Table_res[k].q_length + result.length;
                    console.log("a:"+Temp_Union);
                    var temp_simila = 0;
                    if(Table_res[k].q_1 == result[j][0]){temp_simila+=0.5;console.log("1");}
                    if(Table_res[k].q_2 == result[j][1]){temp_simila+=0.3;console.log("2");}
                    if(Table_res[k].q_3 == result[j][2]){temp_simila+=0.1;console.log("3");}
                    if(Table_res[k].q_4 == result[j][3]){temp_simila+=0.1;console.log("4");}

                    if(key_word_simila < temp_simila){
                      key_word_simila = temp_simila;
                      key_word_index = k;
                    }
                  }else if(Table_res[k].id > i){
                    break;
                  }
                }

                Table_res[key_word_index].q_1 = "";
                Table_res[key_word_index].q_2 = "";
                Table_res[key_word_index].q_3 = "";
                Table_res[key_word_index].q_4 = "";
                Temp_Union -= key_word_simila;
                TempIntersection += key_word_simila;
                console.log("b:"+Temp_Union);
              }
              console.log("INTER : " + TempIntersection + " , UNION : " + Temp_Union);

              var Temp_Similarity = TempIntersection/Temp_Union;
              if(Similarity < Temp_Similarity){
                Similarity = Temp_Similarity;
                Similarity_Q_Id = i;
              }
            }
            console.log(result);
            console.log("simila : " + Similarity + " , Index : " + Similarity_Q_Id);

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
