var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var mysql = require('mysql');
var mecab = require('mecab-ffi');
var sleep = require('system-sleep');
var Horseman = require('node-horseman');
var path = require('path');
var fs = require('fs');

var client = mysql.createConnection({
    hostname : "127.0.0.1:3306",
    user : "root",
    password : "a123123",
    database : "qna"
});

app.use(bodyParser.json());

app.listen(8080,function(){
  require('date-utils');
  var dt = new Date();
  var d = dt.toFormat('YYYY-MM-DD HH24:MI:SS');

  console.log('--------------------------------------------');
  console.log(' - 2018.03.01');
  console.log(' - Present by PL Lab');
  console.log(' - Sim Dae-Soo');
  console.log(' - Graduate Kakao Chat Bot ( V.0.0.1 )');
  console.log('--------------------------------------------');
  console.log(' - Chat Bot server is on!');
  console.log(' - Running Time : ' + d);
  console.log('--------------------------------------------')
});

app.get('/keyboard',function(req,res){
  let keyboard = {
    "type" : "text"
  };
  res.send(keyboard);
});

function outputEmbedding(callback){
  var fs = require('fs');
  var text = '';
  var q_length;
  var word;
  var Embedding_Array = new Array();
  var Word_Array = new Array();
  var Count_Array = new Array();
  var Window_Length = 2;


  /*
    Word Embedding 2018.05.08 Sim Dae-Soo
  */
  console.log(" - Word Embedding is start!");
  client.query('SELECT * FROM A_Table',function(err,Answer_tbl){
    client.query('SELECT * FROM Q_Table',function(err,Table_res){
      client.query('SELECT * FROM Count_Table',function(err,count_res){
        q_length = count_res[0].tot_q;

        /*
          Word Embedding 2018.05.08 Sim Dae-Soo
        */
        var i = 0;
        var j = 0;
        var flag = 0;
        var arr_index = 0;
        var temp_index = 0;

        while(i < q_length)
        {
          word = Table_res[j].q_1;
          arr_index = getIndex(Word_Array,Count_Array,Embedding_Array,word);
          Count_Array[arr_index]++;
          temp_index = j - Window_Length;

          while(temp_index <= j + Window_Length)
          {
            if(temp_index == j || temp_index < 0 || Table_res[temp_index].q_index >= Table_res[j].q_length){
              temp_index++;
              break;
            }else if(Table_res[temp_index].id != Table_res[j].id){
              temp_index++;
              break;
            }else{
              var temp_word = Table_res[temp_index].q_1;
              var x = getIndex(Word_Array,Count_Array,Embedding_Array,temp_word);

              temp_word = Table_res[j].q_1;
              var y = getIndex(Word_Array,Count_Array,Embedding_Array,temp_word);

              Embedding_Array[x][y]++;
              temp_index++;
            }
          }

          j++;
          if(Table_res[i].id != Table_res[j].id){
            i++;
          }
        }

        text += "Part_1" + Word_Array.length + "Part_2";

        for(i=0;i<Word_Array.length;i++)
        {
          text += "(" + Word_Array[i] + ")";
        }

        text += 'Part_3';

        for(i=0;i<Count_Array.length;i++)
        {
          text += "(" + Count_Array[i] + ")";
        }

        text += 'Part_4';

        for(i=0;i<Embedding_Array.length;i++)
        {
          for(j=0;j<Embedding_Array[i].length;j++){
            text += "(" + Embedding_Array[i][j] + ")";
          }
          text += 'Line';
        }
        text += 'EOT';
        fs.writeFileSync("word_embedding.txt", '\ufeff' + text, {encoding: 'utf8'});
        console.log(" - Word Embedding is done!");
        return callback(text);
      });
    });
  });
}

function getIndex(Word_Arr,Count_Arr,Embedding_Arr,Word){
  var flag = 0;
  var i = 0;
  var j = 0;

  for(i=0;i<Word_Arr.length;i++)
  {
    if(Word_Arr[i] == Word){
      flag = 1;
      break;
    }
  }
  if(flag == 1){
    return i;
  }else{
    Word_Arr.push(Word);
    Count_Arr.push(0);
    var Arr = new Array();
    Embedding_Arr.push(Arr);
    Embedding_Arr[Embedding_Arr.length-1].push(0);

    for(j=0;j<Embedding_Arr.length;j++){
      Embedding_Arr[j].push(0);
      Embedding_Arr[Embedding_Arr.length-1].push(0);
    }

    return (Embedding_Arr.length-1);
  }
}

app.post('/message', function(req,res){
  let user_key = decodeURIComponent(req.body.user_key); // user's key
  let type = decodeURIComponent(req.body.type); // message type
  let content = decodeURIComponent(req.body.content); // user's message
  var toStringRes = "";
  var system_mode;
  var learn_error = 0;

  var Embedding_Array = new Array();
  var Word_Array = new Array();
  var Count_Array = new Array();
  var Window_Length = 2;

  client.query('SELECT * FROM Sys_User WHERE user_key='+'\''+user_key+'\'',function(err,query_res){
    if(query_res.length==0){
      client.query('INSERT INTO Sys_User(user_key,sys_status) VALUES ('+'\''+user_key+'\''+',0)',function(err,query_res){
        system_mode = 0;
      });
    }else{
      system_mode = query_res[0].sys_status;
    }

    /*
      Training Mode 2018.05.08 Sim Dae-Soo
      ex) Q @@ A
    */
    if(system_mode == 1){
      var temp_a = content.split("@@")[1];
      var temp_q = content.split("@@")[0];
      if(temp_q != undefined){
        content = temp_q;
      }

      if(temp_q != undefined && temp_a != undefined){
        if((temp_q.length>0 && temp_a.length>0)||(temp_q.length<100 && temp_a.length<100)){
          mecab.parse(temp_q, function(err, result) {
            var length = result.length;
            var index = 1;
            var Q_Type = '';
            var new_q_id = 0; // 비동기니까 잘 처리할 것.

            client.query('SELECT * FROM Count_Table',function(err,res){
              new_q_id = res[0].tot_q;

              var toQuery = "";

              /*
                Make Query 2018.05.08 Sim Dae-Soo
              */
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

              /*
                Save Training Set 2018.05.08 Sim Dae-Soo
              */
              console.log(toQuery);
              client.query('INSERT INTO Q_Table(id,q_index,q_length,q_1,q_2,q_3,q_4,q_count,q_type) VALUES '+toQuery,function(err,query_res_1){
                console.log('INSERT Q_Table', query_res_1);
                mecab.parse(temp_a, function(err, result) {
                  var new_a_id = 0;

                  client.query('SELECT * FROM Count_Table',function(err,res){
                    console.log('Count_Table select', res);
                    new_a_id = res[0].tot_q;
                    var toQuery = "";
                    toQuery+='(\"'+new_a_id+'\"';
                    toQuery+=',\"'+temp_a+'\")';
                    console.log(toQuery);
                    client.query('INSERT INTO A_Table(a_id,answer) VALUES '+toQuery,function(err,query_res_2){
                      console.log('A_table', query_res_2);
                      new_a_id++;
                      client.query('UPDATE Count_Table SET tot_q ='+new_a_id,function(err,query_res_3){
                        console.log('Tot_Q Update', query_res_3);
                      });
                    });
                  });
                });
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

    sleep(100);

    /*
      Select Sentence 2018.05.08 Sim Dae-Soo
    */
    client.query('SELECT * FROM A_Table',function(err,Answer_tbl){
      client.query('SELECT * FROM Q_Table',function(err,Table_res){

        mecab.parse(content, function(err, result) {
          var q_length = 0; // 비동기니까 잘 처리할 것.

          client.query('SELECT * FROM Count_Table',function(err,count_res){
            q_length = count_res[0].tot_q;
            if(system_mode == 2){
              for( var key in result ) {
                toStringRes += key + '['+result[key]+']\n';
              }
            }

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
                /*
                  Similarity Calculate 2018.05.08 Sim Dae-Soo
                */
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

                // 명령어 분기.
                if (Answer_tbl[Similarity_Q_Id].answer.split('system(')[1] != undefined) {
                  var filename = systemParser(Answer_tbl[Similarity_Q_Id].answer);
                  answer = {
                    "message":{
                      "text":Answer_tbl[Similarity_Q_Id].answer + "\n[유사도 : " +level+ "]", // in case 'text'
                      "photo": {
                        "url": "http://13.125.224.92:8080/images/"+filename,
                        "width": 632,
                        "height": 499
                      }
                    }
                  }
                } else {
                  if(Similarity <55 && TempIntersection+Temp_Union <= 10)
                  {
                    answer = {
                      "message":{
                        "text":Answer_tbl[Similarity_Q_Id].answer +"\n<System : 응답성이 떨어집니다>\n[유사도 : 매우낮음]\n#학습모드에서 학습시켜 주세요." // in case 'text'
                      }
                    }
                  }else if(Similarity <47 && TempIntersection+Temp_Union <= 13)
                  {
                    answer = {
                      "message":{
                        "text":Answer_tbl[Similarity_Q_Id].answer +"\n<System : 응답성이 떨어집니다>\n[유사도 : 매우낮음]\n#학습모드에서 학습시켜 주세요." // in case 'text'
                      }
                    }
                  }else if(Similarity <39 && TempIntersection+Temp_Union <= 16)
                  {
                    answer = {
                      "message":{
                        "text":Answer_tbl[Similarity_Q_Id].answer +"\n<System : 응답성이 떨어집니다>\n[유사도 : 매우낮음]\n#학습모드에서 학습시켜 주세요." // in case 'text'
                      }
                    }
                  }else if(Similarity < 32 &&  TempIntersection+Temp_Union <= 19){
                    answer = {
                      "message":{
                        "text":Answer_tbl[Similarity_Q_Id].answer +"\n<System : 응답성이 떨어집니다>\n[유사도 : 매우낮음]\n#학습모드에서 학습시켜 주세요." // in case 'text'
                      }
                    }
                  }else if(Similarity < 22){
                    answer = {
                      "message":{
                        "text":Answer_tbl[Similarity_Q_Id].answer +"\n<System : 응답성이 떨어집니다>\n[유사도 : 매우낮음]\n#학습모드에서 학습시켜 주세요." // in case 'text'
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
                        "text":Answer_tbl[Similarity_Q_Id].answer + "\n[유사도 : " +Similarity+ "% ]", // in case 'text'
                      }
                    }
                  }
                }
                res.send(answer);
              }
            }
          });
        });
      });
    });
  });
});

/*
  Hompage 2018.05.08 Sim Dae-Soo
*/
app.get('/images/*', function(req, res) {
  console.log(req.body);

  var filename = 'img.JPEG';
  fs.readFile(__dirname + "/images/" + filename,
    function (err, data)
    {
      res.writeHead(200, { "Context-Type": "image/jpg" });
      res.write(data);
      res.end();
    }
  );
});

app.get('/home', function(req, res) {
  res.sendFile(__dirname + "/index.html");
});

app.get('/embedding', function(req, res) {
  res.sendFile(__dirname + "/embedding.html");
});

app.get('/wordembedding',function(req,res){
  var text = outputEmbedding(function(text){
    var data = {string:text};
    res.json(data);
  });
});

function systemParser(string) {
  var command = string.split('(')[1].split(')')[0].split('[')[0].replace(/'/g,'').split(',')[0];
  var selector = string.split('(')[1].split(')')[0].split('[')[0].replace(/'/g,'').split(',')[1];
  var option = string.split('(')[1].split(')')[0].split('[')[1].replace(/[+/'+]]*/g,'').split(',')

  var param = {
    selector: selector,
    param: option
  };

  return search(param);
}

function search(options) {
  var query = '';
  var selector = options.selector;

  for(i=0;i<options.param.length;i++)
  {
    query += '+' + options.param[i];
  }

  var horseman = new Horseman();
  var uri = 'https://www.google.co.kr/search?q='+query;
  var encoded = encodeURI(uri);
  var date = new Date().toTimeString().replace(/:/g, '');
  console.log(encoded);
  var url = encoded;
  horseman.userAgent('Mozilla/5.0 (Windows NT 6.1; WOW64; rv:27.0) Gecko/20100101 Firefox/27.0')
  .open(url)
  sleep(1000);
  horseman.crop(selector, __dirname+'/images/'+date+'.JPEG');
  sleep(1500);

  return date+'.JPEG';
}
