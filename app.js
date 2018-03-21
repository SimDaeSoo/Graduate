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
  var learn_error = 0;
  // console.log('req : '+req);
  // console.log('user_key : '+user_key);
  // console.log('type : '+type);
  // console.log('input : '+content);
  // console.log(new Date() + " , user_key : "+user_key);

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
      var temp_a = content.split("@@")[1];
      var temp_q = content.split("@@")[0];
      if(temp_q != undefined){
        content = temp_q;
      }

      if(temp_q != undefined && temp_a != undefined){
        if(temp_q.length>0 && temp_a.length>0){
          mecab.parse(temp_q, function(err, result) {
            var length = result.length;
            var index = 1;
            var Q_Type = '';
            var new_q_id = 0; // 비동기니까 잘 처리할 것.

            client.query('SELECT * FROM Count_Table',function(err,res){
              new_q_id = res[0].tot_q;

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
              //id q_index q_length q_1 q_2 q_3 q_4 q_count q_type
              client.query('INSERT INTO Q_Table(id,q_index,q_length,q_1,q_2,q_3,q_4,q_count,q_type) VALUES '+toQuery,function(err,query_res){
                if(query_res.affectedRows > 0){
                console.log(query_res);
                  mecab.parse(temp_a, function(err, result) {
                    var new_a_id = 0; // 비동기니까 잘 처리할 것.

                    client.query('SELECT * FROM Count_Table',function(err,res){
                      new_a_id = res[0].tot_q;
                      var toQuery = "";
                      toQuery+='(\''+new_a_id+'\'';
                      toQuery+=',\''+temp_a+'\')';
                      client.query('INSERT INTO A_Table(a_id,answer) VALUES '+toQuery,function(err,query_res){
                      });
                      new_a_id++;
                      client.query('UPDATE Count_Table SET tot_q ='+new_a_id,function(err,query_res){
                      });
                    });
                  });
                }else{
                  learn_error = 1;
                }
              });
            });
          });
        }else{
          learn_error = 1;
        }
      }else{
        learn_error = 1;
      }
    }
    //--------------------------------------------------------------------------------------------------------------------------
    client.query('SELECT * FROM A_Table',function(err,Answer_tbl){
      client.query('SELECT * FROM Q_Table',function(err,Table_res){
        mecab.parse(content, function(err, result) {
          var q_length = 0; // 비동기니까 잘 처리할 것.
          //--------------------------------------------------------------------------------
          client.query('SELECT * FROM Count_Table',function(err,count_res){
            q_length = count_res[0].tot_q;
            if(system_mode == 2){
              for( var key in result ) {
                toStringRes += key + '['+result[key]+']\n';
              }
            }
            //--------------------------------------------------------------------------------
            var answer;

            if(content.split("#학습모드")[1] != undefined){
              system_mode = 1;
              client.query('UPDATE Sys_User SET sys_status=1 WHERE user_key='+'\''+user_key+'\'',function(err,q_res){
                answer = {
                  "message":{
                    "text":"<System : 학습 모드로 변경>\nInput : {Question} @@ {Answer}\nEx) 오늘뭐해? @@ 전 밥먹어요!"
                  }
                }
                res.send(answer);
              });
            }else if(content.split("#분석모드")[1] != undefined){
              system_mode = 2;
              client.query('UPDATE Sys_User SET sys_status=2 WHERE user_key='+'\''+user_key+'\'',function(err,q_res){
                answer = {
                  "message":{
                    "text":"<System : 분석모드 변경>"
                  }
                }
                res.send(answer);
              });
            }else if(content.split("#회화모드")[1] != undefined){
              system_mode = 0;
              client.query('UPDATE Sys_User SET sys_status=0 WHERE user_key='+'\''+user_key+'\'',function(err,q_res){
                answer = {
                  "message":{
                    "text":"<System : 회화모드 변경>"
                  }
                }
                res.send(answer);
              });
            }else if(content.split("#평균유사도")[1] != undefined){
              client.query('SELECT * FROM Count_Table',function(err,q_res){
                answer = {
                  "message":{
                    "text":"<System : 평균유사도>\nQuestion Count : " + q_res[0].tot_answer_cnt + "\nAvg Similarity : " + (q_res[0].tot_avg_score / q_res[0].tot_answer_cnt).toFixed(2) + "%"
                  }
                }
                res.send(answer);
              });
            }else if(content.split("#모드")[1] != undefined){
                answer = {
                  "message":{
                    "text":"<System : 모드>\n#회화모드\n#학습모드\n#분석모드\n#평균유사도\n#모드"
                  }
                }
                res.send(answer);
            }else{
              if(system_mode == 1){
                if(learn_error == 1){
                  answer = {
                    "message":{
                      "text":"<System : 학습실패>" // in case 'text'
                    }
                  }
                }else{
                  answer = {
                    "message":{
                      "text":"<System : 학습완료>" // in case 'text'
                    }
                  }
                }
              }else if(system_mode == 2){
                answer = {
                  "message":{
                    "text":"<System : 형태소 분석 결과>\n"+toStringRes // in case 'text'
                  }
                }
              }else if(system_mode == 0){
                var Similarity = 0;
                var Similarity_Q_Id = 0;

                for(i=0;i<q_length;i++){
                  var Temp_Union = 0;
                  var TempIntersection = 0;
                  var flag = 0;

                  for(j=0;j<result.length;j++){
                    var key_word_simila = 0;
                    var key_word_index = 0;

                    for(k=0;k<Table_res.length;k++){
                      if(Table_res[k].id < i){
                        k += Table_res[k].q_length-1;
                      }else if(Table_res[k].id == i){
                        if(flag == 0){
                          Temp_Union = Table_res[k].q_length + result.length;
                          flag = 1;
                        }

                        var temp_simila = 0;
                        if(Table_res[k].q_1 == result[j][0]){temp_simila+=0.5*result[j][0].length;}
                        if(Table_res[k].q_2 == result[j][1]){temp_simila+=0.3*result[j][1].length;}
                        if(Table_res[k].q_3 == result[j][2]){temp_simila+=0.1*result[j][2].length;}
                        if(Table_res[k].q_4 == result[j][3]){temp_simila+=0.1*result[j][3].length;}

                        var total_length = result[j][0].length*0.5+result[j][1].length*0.3+result[j][2].length*0.1+result[j][3].length*0.1;

                        temp_simila = temp_simila / total_length;

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
                  }

                  var Temp_Similarity = TempIntersection/Temp_Union;
                  if(Similarity+0.002 < Temp_Similarity){
                    Similarity = Temp_Similarity;
                    Similarity_Q_Id = i;
                  }else if(Similarity+0.002 >= Temp_Similarity && Similarity <= Temp_Similarity){
                    if(Math.random() < 0.5){
                      Similarity = Temp_Similarity;
                      Similarity_Q_Id = i;
                    }
                  }
                }

                Similarity = (Similarity*100).toFixed(2);
                client.query('UPDATE Count_Table SET tot_avg_score = tot_avg_score + '+Similarity+",tot_answer_cnt = tot_answer_cnt + 1",function(err,q_res){
                });

                if(Similarity <55 && TempIntersection+Temp_Union <= 10)
                {
                  answer = {
                    "message":{
                      "text":"<System : 응답성이 떨어집니다>\n[유사도 : 매우낮음]\n#학습모드에서 학습시켜 주세요." // in case 'text'
                    }
                  }
                }else if(Similarity <47 && TempIntersection+Temp_Union <= 13)
                {
                  answer = {
                    "message":{
                      "text":"<System : 응답성이 떨어집니다>\n[유사도 : 매우낮음]\n#학습모드에서 학습시켜 주세요." // in case 'text'
                    }
                  }
                }else if(Similarity <39 && TempIntersection+Temp_Union <= 16)
                {
                  answer = {
                    "message":{
                      "text":"<System : 응답성이 떨어집니다>\n[유사도 : 매우낮음]\n#학습모드에서 학습시켜 주세요." // in case 'text'
                    }
                  }
                }else if(Similarity < 32 &&  TempIntersection+Temp_Union <= 19){
                  answer = {
                    "message":{
                      "text":"<System : 응답성이 떨어집니다>\n[유사도 : 매우낮음]\n#학습모드에서 학습시켜 주세요." // in case 'text'
                    }
                  }
                }else if(Similarity < 22){
                  answer = {
                    "message":{
                      "text":"<System : 응답성이 떨어집니다>\n[유사도 : 매우낮음]\n#학습모드에서 학습시켜 주세요." // in case 'text'
                    }
                  }
                }else{
                  var level = "";
                  if(Similarity < 45){
                    level = "낮음";
                  }else if(Similarity < 65){
                    level = "보통";
                  }else if(Similarity < 85){
                    level = "높음";
                  }else{
                    level = "매우높음";
                  }
                  answer = {
                    "message":{
                      "text":Answer_tbl[Similarity_Q_Id].answer + "\n[유사도 : " +level+"]" // in case 'text'
                    }
                  }
                }
              }
              res.send(answer);
            }
          });
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
