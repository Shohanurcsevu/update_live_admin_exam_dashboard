<?php
/**
 * api/written/exam_builder.php
 * Create/update/get written & mixed exams with sections + questions
 * Actions: create_exam | update_exam | get_exam | save_questions | reorder_questions
 *          add_section | update_section | delete_section | reorder_sections
 *          add_question | remove_question | update_question_space
 */
require_once '../subject/db_connect.php';
require_once 'utils.php';

$action = $_GET['action'] ?? 'get_exam';
switch ($action) {
    case 'list_exams':          eb_list_exams($conn);           break;
    case 'create_exam':         eb_create_exam($conn);          break;
    case 'update_exam':         eb_update_exam($conn);          break;
    case 'get_exam':            eb_get_exam($conn);             break;
    case 'delete_exam':         eb_delete_exam($conn);          break;
    case 'add_section':         eb_add_section($conn);          break;
    case 'update_section':      eb_update_section($conn);       break;
    case 'delete_section':      eb_delete_section($conn);       break;
    case 'reorder_sections':    eb_reorder_sections($conn);     break;
    case 'add_question':        eb_add_question($conn);         break;
    case 'remove_question':     eb_remove_question($conn);      break;
    case 'update_question':     eb_update_question_space($conn);break;
    case 'reorder_questions':   eb_reorder_questions($conn);    break;
    case 'save_all_questions':  eb_save_all_questions($conn);   break;
    default: eb_json(['success'=>false,'message'=>'Invalid action.']);
}

function eb_json($d){ echo json_encode($d, JSON_UNESCAPED_UNICODE); }

/* ─── LIST EXAMS (browse panel) ────────────────────────────────────────────── */
function eb_list_exams($conn) {
    $wheres = ["e.is_deleted=0"];
    $params = []; $types = '';

    if (!empty($_GET['subject_id'])) {
        $wheres[] = 'e.subject_id=?'; $params[] = intval($_GET['subject_id']); $types .= 'i';
    }
    if (!empty($_GET['lesson_id'])) {
        $wheres[] = 'e.lesson_id=?';  $params[] = intval($_GET['lesson_id']);  $types .= 'i';
    }
    if (!empty($_GET['topic_id'])) {
        $wheres[] = 'e.topic_id=?';   $params[] = intval($_GET['topic_id']);   $types .= 'i';
    }
    if (!empty($_GET['exam_type'])) {
        $wheres[] = 'e.exam_type=?';  $params[] = $_GET['exam_type'];          $types .= 's';
    }
    if (!empty($_GET['search'])) {
        $wheres[] = 'e.exam_title LIKE ?'; $params[] = '%'.$_GET['search'].'%'; $types .= 's';
    }

    $w = implode(' AND ', $wheres);
    $sql = "SELECT e.id, e.exam_title, e.exam_type, e.duration, e.total_marks, e.created_at,
                   s.subject_name, l.lesson_name, t.topic_name,
                   (SELECT COUNT(*) FROM questions q WHERE q.exam_id=e.id AND q.is_deleted=0) AS mcq_count,
                   (SELECT COUNT(*) FROM written_exam_questions wq WHERE wq.exam_id=e.id)     AS written_count,
                   (SELECT COUNT(*) FROM written_exam_sections ws WHERE ws.exam_id=e.id)      AS section_count
            FROM exams e
            LEFT JOIN subjects s ON e.subject_id=s.id
            LEFT JOIN lessons  l ON e.lesson_id=l.id
            LEFT JOIN topics   t ON e.topic_id=t.id
            WHERE $w
            ORDER BY e.created_at DESC
            LIMIT 60";

    $stmt = $conn->prepare($sql);
    if ($types) $stmt->bind_param($types, ...$params);
    $stmt->execute();
    $rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();
    eb_json(['success'=>true,'data'=>$rows,'count'=>count($rows)]);
}


/* ─── CREATE EXAM ──────────────────────────────────────────────────────────── */
function eb_create_exam($conn) {
    $d = json_decode(file_get_contents('php://input'), true) ?? [];
    if (empty($d['exam_title'])) { eb_json(['success'=>false,'message'=>'exam_title required.']); return; }

    $subject_id = intval($d['subject_id'] ?? 0) ?: null;
    $lesson_id  = intval($d['lesson_id']  ?? 0) ?: null;
    $topic_id   = intval($d['topic_id']   ?? 0) ?: null;
    $title      = trim($d['exam_title']);
    $duration   = intval($d['duration'] ?? 180);
    $total_marks= floatval($d['total_marks'] ?? 0);
    $pass_mark  = floatval($d['pass_mark']   ?? 0);
    $instructions= trim($d['instructions']  ?? '');
    $exam_type  = in_array($d['exam_type']??'', ['mcq','written','mixed']) ? $d['exam_type'] : 'written';

    $neg = 0.00;
    // Types: i i i s i d d s s d  (subject,lesson,topic,title,duration,total_marks,pass_mark,instructions,exam_type,neg)
    $stmt = $conn->prepare(
        "INSERT INTO exams (subject_id,lesson_id,topic_id,exam_title,duration,total_marks,pass_mark,instructions,exam_type,negative_mark_value)
         VALUES (?,?,?,?,?,?,?,?,?,?)"
    );
    $stmt->bind_param('iiisiddssd', $subject_id,$lesson_id,$topic_id,$title,$duration,$total_marks,$pass_mark,$instructions,$exam_type,$neg);
    if (!$stmt->execute()) { eb_json(['success'=>false,'message'=>$conn->error]); $stmt->close(); return; }
    $exam_id = $conn->insert_id; $stmt->close();

    log_written_activity($conn, 'Written Exam Created', "Exam '$title' (ID $exam_id) created.");
    eb_json(['success'=>true,'exam_id'=>$exam_id,'message'=>'Exam created.']);
}

/* ─── UPDATE EXAM ──────────────────────────────────────────────────────────── */
function eb_update_exam($conn) {
    $d = json_decode(file_get_contents('php://input'), true) ?? [];
    $exam_id = intval($d['exam_id'] ?? 0);
    if (!$exam_id) { eb_json(['success'=>false,'message'=>'exam_id required.']); return; }

    $title      = trim($d['exam_title'] ?? '');
    $duration   = intval($d['duration'] ?? 180);
    $total_marks= floatval($d['total_marks'] ?? 0);
    $pass_mark  = floatval($d['pass_mark']   ?? 0);
    $instructions= trim($d['instructions']  ?? '');
    $exam_type  = in_array($d['exam_type']??'', ['mcq','written','mixed']) ? $d['exam_type'] : 'written';
    $subject_id = intval($d['subject_id'] ?? 0) ?: null;
    $lesson_id  = intval($d['lesson_id']  ?? 0) ?: null;
    $topic_id   = intval($d['topic_id']   ?? 0) ?: null;

    $u = $conn->prepare(
        "UPDATE exams SET subject_id=?,lesson_id=?,topic_id=?,exam_title=?,duration=?,total_marks=?,pass_mark=?,instructions=?,exam_type=? WHERE id=?"
    );
    // i i i s i d d s s i
    $u->bind_param('iiisiddssi', $subject_id,$lesson_id,$topic_id,$title,$duration,$total_marks,$pass_mark,$instructions,$exam_type,$exam_id);
    if (!$u->execute()) { eb_json(['success'=>false,'message'=>$conn->error]); $u->close(); return; }
    $u->close();
    eb_json(['success'=>true,'message'=>'Exam updated.']);
}

/* ─── GET EXAM (full structure) ─────────────────────────────────────────────── */
function eb_get_exam($conn) {
    $exam_id = intval($_GET['exam_id'] ?? 0);
    if (!$exam_id) { eb_json(['success'=>false,'message'=>'exam_id required.']); return; }

    // Exam details
    $s = $conn->prepare("SELECT e.*,s.subject_name,l.lesson_name,t.topic_name FROM exams e LEFT JOIN subjects s ON e.subject_id=s.id LEFT JOIN lessons l ON e.lesson_id=l.id LEFT JOIN topics t ON e.topic_id=t.id WHERE e.id=? AND e.is_deleted=0");
    $s->bind_param('i',$exam_id); $s->execute();
    $exam = $s->get_result()->fetch_assoc(); $s->close();
    if (!$exam) { eb_json(['success'=>false,'message'=>'Exam not found.']); return; }

    // Sections
    $ss = $conn->prepare("SELECT * FROM written_exam_sections WHERE exam_id=? ORDER BY display_order");
    $ss->bind_param('i',$exam_id); $ss->execute();
    $sections = $ss->get_result()->fetch_all(MYSQLI_ASSOC); $ss->close();

    // Written questions (with sub-questions)
    $qs = $conn->prepare("SELECT * FROM written_exam_questions WHERE exam_id=? ORDER BY section_id, display_order");
    $qs->bind_param('i',$exam_id); $qs->execute();
    $questions = $qs->get_result()->fetch_all(MYSQLI_ASSOC); $qs->close();

    foreach ($questions as &$q) {
        $sqst = $conn->prepare("SELECT * FROM written_exam_sub_questions WHERE exam_question_id=? ORDER BY display_order");
        $sqst->bind_param('i',$q['id']); $sqst->execute();
        $q['sub_questions'] = $sqst->get_result()->fetch_all(MYSQLI_ASSOC); $sqst->close();
    }

    // MCQ questions from shared `questions` table (same exam_id)
    $mqs = $conn->prepare("SELECT id, question, options, answer, explanation, priority AS display_order FROM questions WHERE exam_id=? AND is_deleted=0 ORDER BY priority, id");
    $mqs->bind_param('i', $exam_id); $mqs->execute();
    $mcq_rows = $mqs->get_result()->fetch_all(MYSQLI_ASSOC); $mqs->close();
    foreach ($mcq_rows as &$mq) {
        $mq['options'] = json_decode($mq['options'] ?? '[]', true) ?: [];
    }

    eb_json(['success'=>true,'data'=>['exam'=>$exam,'sections'=>$sections,'questions'=>$questions,'mcq_questions'=>$mcq_rows]]);
}

/* ─── SECTIONS ──────────────────────────────────────────────────────────────── */
function eb_add_section($conn) {
    $d = json_decode(file_get_contents('php://input'), true) ?? [];
    $exam_id = intval($d['exam_id'] ?? 0);
    if (!$exam_id) { eb_json(['success'=>false,'message'=>'exam_id required.']); return; }
    $title = trim($d['section_title'] ?? '');
    $inst  = trim($d['section_instructions'] ?? '');
    $order = intval($d['display_order'] ?? 0);
    $s = $conn->prepare("INSERT INTO written_exam_sections (exam_id,section_title,section_instructions,display_order) VALUES (?,?,?,?)");
    $s->bind_param('issi',$exam_id,$title,$inst,$order);
    $s->execute(); $new_id=$conn->insert_id; $s->close();
    eb_json(['success'=>true,'id'=>$new_id,'message'=>'Section added.']);
}

function eb_update_section($conn) {
    $d = json_decode(file_get_contents('php://input'), true) ?? [];
    $id = intval($d['id'] ?? 0);
    if (!$id) { eb_json(['success'=>false,'message'=>'id required.']); return; }
    $title = trim($d['section_title'] ?? '');
    $inst  = trim($d['section_instructions'] ?? '');
    $order = intval($d['display_order'] ?? 0);
    $u = $conn->prepare("UPDATE written_exam_sections SET section_title=?,section_instructions=?,display_order=? WHERE id=?");
    $u->bind_param('ssii',$title,$inst,$order,$id); $u->execute(); $u->close();
    eb_json(['success'=>true,'message'=>'Section updated.']);
}

function eb_delete_section($conn) {
    $d = json_decode(file_get_contents('php://input'), true) ?? [];
    $id = intval($d['id'] ?? 0);
    if (!$id) { eb_json(['success'=>false,'message'=>'id required.']); return; }
    // Unassign questions from this section first
    $ua = $conn->prepare("UPDATE written_exam_questions SET section_id=NULL WHERE section_id=?");
    $ua->bind_param('i',$id); $ua->execute(); $ua->close();
    $dl = $conn->prepare("DELETE FROM written_exam_sections WHERE id=?");
    $dl->bind_param('i',$id); $dl->execute(); $dl->close();
    eb_json(['success'=>true,'message'=>'Section deleted.']);
}

function eb_reorder_sections($conn) {
    $d = json_decode(file_get_contents('php://input'), true) ?? [];
    $order = $d['order'] ?? []; // [{id:1,display_order:0},{id:2,display_order:1}]
    foreach ($order as $item) {
        $u = $conn->prepare("UPDATE written_exam_sections SET display_order=? WHERE id=?");
        $u->bind_param('ii',intval($item['display_order']),intval($item['id'])); $u->execute(); $u->close();
    }
    eb_json(['success'=>true,'message'=>'Sections reordered.']);
}

/* ─── QUESTIONS ─────────────────────────────────────────────────────────────── */
function eb_add_question($conn) {
    $d = json_decode(file_get_contents('php://input'), true) ?? [];
    $exam_id = intval($d['exam_id'] ?? 0);
    if (!$exam_id) { eb_json(['success'=>false,'message'=>'exam_id required.']); return; }

    $section_id      = intval($d['section_id'] ?? 0) ?: null;
    $source_id       = intval($d['source_question_id'] ?? 0) ?: null;
    $q_text          = trim($d['question_text'] ?? '');
    $q_type          = sanitize_question_type($d['question_type'] ?? 'short_answer');
    $marks           = floatval($d['marks'] ?? 1);
    $img             = trim($d['image_path'] ?? '');
    $hf              = intval($d['has_formula'] ?? 0);
    $order           = intval($d['display_order'] ?? 999);
    $ans_space       = in_array($d['answer_space']??'',['small','medium','large','custom']) ? $d['answer_space'] : 'medium';
    $ans_lines       = intval($d['answer_space_lines'] ?? answer_space_to_lines($ans_space));

    $s = $conn->prepare(
        "INSERT INTO written_exam_questions (exam_id,section_id,source_question_id,question_text,question_type,marks,image_path,has_formula,display_order,answer_space,answer_space_lines)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)"
    );
    // i i i s s d s i i s i
    $s->bind_param('iiissdsiisi', $exam_id,$section_id,$source_id,$q_text,$q_type,$marks,$img,$hf,$order,$ans_space,$ans_lines);
    $s->execute(); $new_id = $conn->insert_id; $s->close();

    // Sub-questions
    if (!empty($d['sub_questions']) && is_array($d['sub_questions'])) {
        insert_exam_sub_questions($conn, $new_id, $d['sub_questions']);
    }

    eb_json(['success'=>true,'id'=>$new_id,'message'=>'Question added to exam.']);
}

function eb_remove_question($conn) {
    $d  = json_decode(file_get_contents('php://input'), true) ?? [];
    $id = intval($d['id'] ?? 0);
    if (!$id) { eb_json(['success'=>false,'message'=>'id required.']); return; }
    $dl = $conn->prepare("DELETE FROM written_exam_questions WHERE id=?");
    $dl->bind_param('i',$id); $dl->execute(); $dl->close();
    eb_json(['success'=>true,'message'=>'Question removed.']);
}

function eb_update_question_space($conn) {
    $d  = json_decode(file_get_contents('php://input'), true) ?? [];
    $id = intval($d['id'] ?? 0);
    if (!$id) { eb_json(['success'=>false,'message'=>'id required.']); return; }
    $ans_space = in_array($d['answer_space']??'',['small','medium','large','custom']) ? $d['answer_space'] : 'medium';
    $ans_lines = intval($d['answer_space_lines'] ?? answer_space_to_lines($ans_space));
    $section_id = isset($d['section_id']) ? (intval($d['section_id']) ?: null) : false;
    $q_text     = trim($d['question_text'] ?? '');
    $marks      = floatval($d['marks'] ?? 0);

    $sets = ['answer_space=?','answer_space_lines=?'];
    $params = [$ans_space,$ans_lines]; $types='si';
    if ($section_id !== false) { $sets[]='section_id=?'; $params[]=$section_id; $types.='i'; }
    if ($q_text) { $sets[]='question_text=?'; $params[]=$q_text; $types.='s'; }
    if ($marks) { $sets[]='marks=?'; $params[]=$marks; $types.='d'; }
    $params[]=$id; $types.='i';

    $u = $conn->prepare("UPDATE written_exam_questions SET ".implode(',',$sets)." WHERE id=?");
    $u->bind_param($types,...$params); $u->execute(); $u->close();
    eb_json(['success'=>true,'message'=>'Question updated.']);
}

function eb_reorder_questions($conn) {
    $d = json_decode(file_get_contents('php://input'), true) ?? [];
    $order = $d['order'] ?? [];
    foreach ($order as $item) {
        $u = $conn->prepare("UPDATE written_exam_questions SET display_order=?,section_id=? WHERE id=?");
        $sec = intval($item['section_id'] ?? 0) ?: null;
        $u->bind_param('iii',intval($item['display_order']),$sec,intval($item['id'])); $u->execute(); $u->close();
    }
    eb_json(['success'=>true,'message'=>'Questions reordered.']);
}

/* Save ALL questions for an exam at once (replace approach) */
function eb_save_all_questions($conn) {
    $d = json_decode(file_get_contents('php://input'), true) ?? [];
    $exam_id = intval($d['exam_id'] ?? 0);
    if (!$exam_id) { eb_json(['success'=>false,'message'=>'exam_id required.']); return; }
    $questions = $d['questions'] ?? [];

    $conn->begin_transaction();
    try {
        // Delete existing
        $dl = $conn->prepare("DELETE FROM written_exam_questions WHERE exam_id=?");
        $dl->bind_param('i',$exam_id); $dl->execute(); $dl->close();

        foreach ($questions as $idx => $q) {
            if (empty($q['question_text'])) continue;
            $section_id = intval($q['section_id'] ?? 0) ?: null;
            $source_id  = intval($q['source_question_id'] ?? 0) ?: null;
            $q_text     = trim($q['question_text']);
            $q_type     = sanitize_question_type($q['question_type'] ?? 'short_answer');
            $marks      = floatval($q['marks'] ?? 1);
            $img        = trim($q['image_path'] ?? '');
            $hf         = intval($q['has_formula'] ?? 0);
            $order      = intval($q['display_order'] ?? $idx);
            $ans_space  = in_array($q['answer_space']??'',['small','medium','large','custom']) ? $q['answer_space'] : 'medium';
            $ans_lines  = intval($q['answer_space_lines'] ?? answer_space_to_lines($ans_space));

            $s = $conn->prepare(
                "INSERT INTO written_exam_questions (exam_id,section_id,source_question_id,question_text,question_type,marks,image_path,has_formula,display_order,answer_space,answer_space_lines)
                 VALUES (?,?,?,?,?,?,?,?,?,?,?)"
            );
            $s->bind_param('iiissdsiisi', $exam_id,$section_id,$source_id,$q_text,$q_type,$marks,$img,$hf,$order,$ans_space,$ans_lines);
            $s->execute(); $new_id=$conn->insert_id; $s->close();

            if (!empty($q['sub_questions'])) {
                insert_exam_sub_questions($conn, $new_id, $q['sub_questions']);
            }
        }
        $conn->commit();
        eb_json(['success'=>true,'message'=>'All questions saved.']);
    } catch (Exception $e) {
        $conn->rollback();
        eb_json(['success'=>false,'message'=>$e->getMessage()]);
    }
}

/* ─── Helper: Insert exam sub-questions ─────────────────────────────────────── */
function insert_exam_sub_questions($conn, $eq_id, $sub_qs) {
    foreach ($sub_qs as $idx => $sq) {
        if (empty($sq['sub_question_text'])) continue;
        $text      = trim($sq['sub_question_text']);
        $marks     = floatval($sq['marks'] ?? 1);
        $img       = trim($sq['image_path'] ?? '');
        $hf        = intval($sq['has_formula'] ?? 0);
        $order     = intval($sq['display_order'] ?? $idx);
        $ans_space = in_array($sq['answer_space']??'',['small','medium','large','custom']) ? $sq['answer_space'] : 'small';
        $ans_lines = intval($sq['answer_space_lines'] ?? answer_space_to_lines($ans_space));

        $s = $conn->prepare(
            "INSERT INTO written_exam_sub_questions (exam_question_id,sub_question_text,marks,image_path,has_formula,display_order,answer_space,answer_space_lines)
             VALUES (?,?,?,?,?,?,?,?)"
        );
        $s->bind_param('isdsiisi', $eq_id,$text,$marks,$img,$hf,$order,$ans_space,$ans_lines);
        $s->execute(); $s->close();
    }
}

/* ─── DELETE EXAM (soft-delete) ─────────────────────────────────────────────── */
function eb_delete_exam($conn) {
    $d = json_decode(file_get_contents('php://input'), true) ?? [];
    $exam_id = intval($d['exam_id'] ?? 0);
    if (!$exam_id) { eb_json(['success'=>false,'message'=>'exam_id required.']); return; }

    // Verify it exists
    $chk = $conn->prepare("SELECT id FROM exams WHERE id=? AND is_deleted=0");
    $chk->bind_param('i',$exam_id); $chk->execute();
    if (!$chk->get_result()->fetch_assoc()) { $chk->close(); eb_json(['success'=>false,'message'=>'Exam not found.']); return; }
    $chk->close();

    // Soft-delete: set is_deleted = 1
    $u = $conn->prepare("UPDATE exams SET is_deleted=1 WHERE id=?");
    $u->bind_param('i',$exam_id);
    if (!$u->execute()) { eb_json(['success'=>false,'message'=>$conn->error]); $u->close(); return; }
    $u->close();

    log_written_activity($conn, 'Written Exam Deleted', "Exam ID $exam_id soft-deleted.");
    eb_json(['success'=>true,'message'=>'Exam deleted.']);
}
