<?php
/**
 * api/written/questions.php
 * Written Question Bank CRUD
 * Actions: list | get | create | update | delete | bulk_create
 */
require_once '../subject/db_connect.php';
require_once 'utils.php';

$action = $_GET['action'] ?? 'list';
switch ($action) {
    case 'list':        wq_list($conn);         break;
    case 'get':         wq_get($conn);          break;
    case 'create':      wq_create($conn);       break;
    case 'update':      wq_update($conn);       break;
    case 'delete':      wq_delete($conn);       break;
    case 'bulk_create': wq_bulk_create($conn);  break;
    default:            wq_json(['success'=>false,'message'=>'Invalid action.']);
}

function wq_json($data){ echo json_encode($data, JSON_UNESCAPED_UNICODE); }

/** Run a prepared statement with named-type mapping */
function wq_exec($conn, $sql, $types, $values) {
    $stmt = $conn->prepare($sql);
    if (!$stmt) return null;
    if ($types && $values) $stmt->bind_param($types, ...$values);
    $stmt->execute();
    return $stmt;
}

/** Get + validate a written question field set */
function wq_fields(array $d): array {
    return [
        'sid'   => intval($d['subject_id']??0) ?: null,
        'lid'   => intval($d['lesson_id']??0)  ?: null,
        'tid'   => intval($d['topic_id']??0)   ?: null,
        'qt'    => trim($d['question_text']??''),
        'qtype' => sanitize_question_type($d['question_type']??'short_answer'),
        'diff'  => in_array($d['difficulty']??'',['easy','medium','hard'])?$d['difficulty']:'medium',
        'marks' => floatval($d['marks']??1),
        'ans'   => trim($d['model_answer']??''),
        'img'   => trim($d['image_path']??''),
        'hf'    => intval($d['has_formula']??0),
        'lang'  => in_array($d['language']??'',['bangla','english','mixed'])?$d['language']:'mixed',
    ];
}

/* ─────────────────────────── LIST ─────────────────────────────────────────── */
function wq_list($conn) {
    $page   = max(1, (int)($_GET['page']??1));
    $limit  = max(1, min(100, (int)($_GET['limit']??20)));
    $offset = ($page-1)*$limit;
    $w=[]; $p=[]; $t='';
    $w[]='wq.is_active=1';
    if(!empty($_GET['subject_id']))   {$w[]='wq.subject_id=?';    $p[]=(int)$_GET['subject_id']; $t.='i';}
    if(!empty($_GET['lesson_id']))    {$w[]='wq.lesson_id=?';     $p[]=(int)$_GET['lesson_id'];  $t.='i';}
    if(!empty($_GET['topic_id']))     {$w[]='wq.topic_id=?';      $p[]=(int)$_GET['topic_id'];   $t.='i';}
    if(!empty($_GET['question_type'])){$w[]='wq.question_type=?'; $p[]=$_GET['question_type'];   $t.='s';}
    if(!empty($_GET['difficulty']))   {$w[]='wq.difficulty=?';    $p[]=$_GET['difficulty'];      $t.='s';}
    if(!empty($_GET['search']))       {$w[]='wq.question_text LIKE ?'; $p[]='%'.$_GET['search'].'%'; $t.='s';}
    $where='WHERE '.implode(' AND ',$w);

    $cs=wq_exec($conn,"SELECT COUNT(*) AS total FROM written_questions wq $where",$t,$p?$p:null);
    $total=(int)$cs->get_result()->fetch_assoc()['total']; $cs->close();

    $sql="SELECT wq.id,wq.question_text,wq.question_type,wq.difficulty,wq.marks,wq.image_path,
                 wq.has_formula,wq.language,wq.subject_id,wq.lesson_id,wq.topic_id,wq.created_at,
                 s.subject_name,l.lesson_name,t.topic_name,
                 (SELECT COUNT(*) FROM written_sub_questions WHERE parent_question_id=wq.id) AS sub_count
          FROM written_questions wq
          LEFT JOIN subjects s ON wq.subject_id=s.id
          LEFT JOIN lessons l ON wq.lesson_id=l.id
          LEFT JOIN topics t ON wq.topic_id=t.id
          $where ORDER BY wq.created_at DESC LIMIT ? OFFSET ?";
    $st=wq_exec($conn,$sql,$t.'ii',[...$p,$limit,$offset]);
    $rows=$st->get_result()->fetch_all(MYSQLI_ASSOC); $st->close();
    wq_json(['success'=>true,'data'=>$rows,'total'=>$total,'page'=>$page,'limit'=>$limit,'pages'=>(int)ceil($total/$limit)]);
}

/* ─────────────────────────── GET ──────────────────────────────────────────── */
function wq_get($conn) {
    $id=(int)($_GET['id']??0);
    if(!$id){wq_json(['success'=>false,'message'=>'ID required.']);return;}
    $s=wq_exec($conn,
        "SELECT wq.*,s.subject_name,l.lesson_name,t.topic_name FROM written_questions wq
         LEFT JOIN subjects s ON wq.subject_id=s.id LEFT JOIN lessons l ON wq.lesson_id=l.id LEFT JOIN topics t ON wq.topic_id=t.id
         WHERE wq.id=?",'i',[$id]);
    $q=$s->get_result()->fetch_assoc(); $s->close();
    if(!$q){wq_json(['success'=>false,'message'=>'Not found.']);return;}
    $ss=wq_exec($conn,"SELECT * FROM written_sub_questions WHERE parent_question_id=? ORDER BY display_order",'i',[$id]);
    $q['sub_questions']=$ss->get_result()->fetch_all(MYSQLI_ASSOC); $ss->close();
    wq_json(['success'=>true,'data'=>$q]);
}

/* ─────────────────────────── CREATE ───────────────────────────────────────── */
function wq_create($conn) {
    $d=json_decode(file_get_contents('php://input'),true)??[];
    if(empty($d['question_text'])){wq_json(['success'=>false,'message'=>'question_text required.']);return;}
    $f=wq_fields($d);
    // Types: i i i s s s d s s i s  (11 params)
    $stmt=wq_exec($conn,
        "INSERT INTO written_questions (subject_id,lesson_id,topic_id,question_text,question_type,difficulty,marks,model_answer,image_path,has_formula,language) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
        'iiisssdss'.'is',
        [$f['sid'],$f['lid'],$f['tid'],$f['qt'],$f['qtype'],$f['diff'],$f['marks'],$f['ans'],$f['img'],$f['hf'],$f['lang']]
    );
    if($conn->error){wq_json(['success'=>false,'message'=>$conn->error]);if($stmt)$stmt->close();return;}
    $new_id=$conn->insert_id; $stmt->close();
    if(!empty($d['sub_questions']))insert_sub_questions($conn,$new_id,$d['sub_questions']);
    log_written_activity($conn,'Written Question Created',"Question #$new_id added to bank.");
    wq_json(['success'=>true,'id'=>$new_id,'message'=>'Question created.']);
}

/* ─────────────────────────── UPDATE ───────────────────────────────────────── */
function wq_update($conn) {
    $d=json_decode(file_get_contents('php://input'),true)??[];
    $id=(int)($d['id']??0);
    if(!$id){wq_json(['success'=>false,'message'=>'ID required.']);return;}
    $f=wq_fields($d);
    // UPDATE type: i i i s s s d s s i s i  (12 = 11 fields + id)
    $stmt=wq_exec($conn,
        "UPDATE written_questions SET subject_id=?,lesson_id=?,topic_id=?,question_text=?,question_type=?,difficulty=?,marks=?,model_answer=?,image_path=?,has_formula=?,language=? WHERE id=?",
        'iiisssdssisi',
        [$f['sid'],$f['lid'],$f['tid'],$f['qt'],$f['qtype'],$f['diff'],$f['marks'],$f['ans'],$f['img'],$f['hf'],$f['lang'],$id]
    );
    // Again last 2 are 'si' but written as 'isi' with lang=s, id=i. Full: i i i s s s d s s i s i — OK ✓
    if($conn->error){wq_json(['success'=>false,'message'=>$conn->error]);$stmt->close();return;}
    $stmt->close();
    $dl=wq_exec($conn,"DELETE FROM written_sub_questions WHERE parent_question_id=?",'i',[$id]);
    $dl->close();
    if(!empty($d['sub_questions']))insert_sub_questions($conn,$id,$d['sub_questions']);
    wq_json(['success'=>true,'message'=>'Updated.']);
}

/* ─────────────────────────── DELETE ───────────────────────────────────────── */
function wq_delete($conn) {
    $d=json_decode(file_get_contents('php://input'),true)??[];
    $id=(int)($d['id']??($_GET['id']??0));
    if(!$id){wq_json(['success'=>false,'message'=>'ID required.']);return;}
    $s=wq_exec($conn,"UPDATE written_questions SET is_active=0 WHERE id=?",'i',[$id]); $s->close();
    wq_json(['success'=>true,'message'=>'Deleted.']);
}

/* ─────────────────────────── BULK CREATE ───────────────────────────────────── */
function wq_bulk_create($conn) {
    $data=json_decode(file_get_contents('php://input'),true)??[];
    $qs=$data['questions']??[];
    if(empty($qs)){wq_json(['success'=>false,'message'=>'questions array required.']);return;}
    $gsid=intval($data['subject_id']??0)?:null;
    $glid=intval($data['lesson_id']??0)?:null;
    $gtid=intval($data['topic_id']??0)?:null;
    $conn->begin_transaction(); $ids=[];
    try {
        foreach($qs as $q){
            if(empty($q['question_text']))continue;
            if(!isset($q['subject_id']))$q['subject_id']=$gsid;
            if(!isset($q['lesson_id'])) $q['lesson_id']=$glid;
            if(!isset($q['topic_id']))  $q['topic_id']=$gtid;
            $f=wq_fields($q);
            $ins=wq_exec($conn,
                "INSERT INTO written_questions (subject_id,lesson_id,topic_id,question_text,question_type,difficulty,marks,model_answer,image_path,has_formula,language) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
                'iiisssdss'.'is',
                [$f['sid'],$f['lid'],$f['tid'],$f['qt'],$f['qtype'],$f['diff'],$f['marks'],$f['ans'],$f['img'],$f['hf'],$f['lang']]
            );
            $new_id=$conn->insert_id; $ins->close(); $ids[]=$new_id;
            if(!empty($q['sub_questions']))insert_sub_questions($conn,$new_id,$q['sub_questions']);
        }
        $conn->commit();
        log_written_activity($conn,'Written Questions Bulk Created',count($ids).' questions added.');
        wq_json(['success'=>true,'ids'=>$ids,'count'=>count($ids)]);
    } catch(Exception $e){ $conn->rollback(); wq_json(['success'=>false,'message'=>$e->getMessage()]); }
}
