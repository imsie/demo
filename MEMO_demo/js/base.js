;(function() {
	'use strict';

	var $form_add_task = $('.add-task');
	var $window = $(window);
	var task_list = [];
	var $task_detail_trigger;
	var $body = $('body');
	var $task_detail_mask = $('.task-detail-mask');
	var $task_detail = $('.task-detail');
	var $msg = $('.msg');
	var $alerter = $('.alerter');
	var $msg_content = $msg.find('.msg-content');
	var $msg_confirm = $msg.find('.confirmed');
	var $task_detail_content;
	var $task_detail_content_input;
	var current_index;
	var $update_form;
	var $checkbox_complete;
	//因为jquery为动态加载，只有在加载之后才能获取到节点对象。
	var $task_delete_trigger;

	init();
	//初始化
	function init() {
		task_list = store.get('task_list') || [];
		if (task_list.length) {
			render_task_list();
		}
		task_remind_check();
		listen_msg_event();
		show_msg();
	}
	$form_add_task.on('submit', on_add_task_form_submit);
	$task_detail_mask.on('click', hide_task_detail);
	//自定义弹出框
	function pop(arg) {
		if (!arg) {
			console.error('title is required');
		}
		var conf = {};
		var $box;
		var $mask;
		var $title;
		var $content;
		var $confirm;
		var $cancel;
		var dfd;
		var confirmed;
		var timer;
		dfd = $.Deferred();


		if (typeof arg == 'string') {
			conf.title = arg;
		} else {
			conf = $.extend(conf, arg);
		}
		$box = $('<div>' + '<div class="pop-title">'+ conf.title +'</div>'+
			'<div class="pop-content">' + 
				'<div><button style="margin-right: 10px;" class="primary confirm">确定</button><button class="cancel">取消</button>' + 
				'<div>' +
			'</div>').css({
			position : 'fixed',
			color : '#333',
			width: '300px',
			height: 'auto',
			padding : '10px 0',
			background: '#fff',
			'border-radius' : '3px',
			'box-shadow ': '2 2 2 rgba(0, 0, 0, 0.5)'
		});

		$title = $box.find('.pop-title').css({
			padding : '25px 10px',
			'font-size' : '20px',
			'text-align' : 'center',
			'font-weight' : 'bold'
		});

		$content = $box.find('.pop-content').css({
			padding : '20px 10px',
			'text-align' : 'center'
		});

		$confirm = $content.find('button.confirm');
		$cancel = $content.find('button.cancel');

		$mask = $('<div></div>').css({
			position: 'fixed',
			background : 'rgba(0, 0, 0, .3)',
			top : 0,
			bottom : 0,
			left : 0,
			right : 0
		});
		$mask.appendTo($body);
		$box.appendTo($body);

		$confirm.on('click', function() {
			confirmed = true;
		});

		$cancel.on('click', function() {
			confirmed = false;
		});

		$mask.on('click', function() {
			confirmed = false;
		});

		timer = setInterval(function() {
			if (confirmed !== undefined) {
				dfd.resolve(confirmed);
				clearInterval(timer);
				dismiss_pop();
			}
		}, 100);

		function dismiss_pop() {
			$box.remove();
			$mask.remove();
		}

		function adjust_box_position() {
			var window_width = $window.width();
			var window_height = $window.height();
			var box_width = $box.width();
			var box_height = $box.height();
			var move_x;
			var move_y;
			move_x = (window_width - box_width) / 2;
			move_y = (window_height - box_height) / 2 - 20;
			$box.css({
				left : move_x,
				top : move_y
			});
		}
		adjust_box_position();
		$window.on('resize', function() {
			adjust_box_position();
		});
		return dfd.promise();	
	}
	//定时提醒功能
	function task_remind_check() {
		var current_timestamp;
		var itl = setInterval(function() {
			for(var i = 0; i < task_list.length; i++) {
			var item = get(i);
			var task_timestamp;
			if (!item || !item.remind_date || item.informed) {
				continue;
			} else {
				current_timestamp = (new Date()).getTime();
				task_timestamp = (new Date(item.remind_date)).getTime();
				if (current_timestamp - task_timestamp >= 1) {
					update_task(i, {'informed' : true});
					show_msg(item.content);
				}
			}
		}
	}, 500);
		
	}

	function show_msg(msg) {
		if (!msg) {
			return;
		}
		$msg_content.html(msg);
		$alerter.get(0).play();
		$msg.show();
	}

	function hide_msg() {
		$msg.hide();
	}

	function listen_msg_event() {
		$msg_confirm.on('click', function() {
			hide_msg();
		})
	}
	//添加task
	function on_add_task_form_submit(e) {
		var new_task = {};
		e.preventDefault();
		var $input = $(this).find('input[name="content"]');
		new_task.content = $input.val();
		if(!new_task.content) {
			return;
		}
		if (add_task(new_task)) {
			refresh_task_list();
			$input.val(null);
		}
	}

	function listen_task_detail() {
		var index;
		$('.task-item').on('dblclick', function() {
			index = $(this).data('index');
			show_task_detail(index);
		});
		$task_detail_trigger.on('click', function() {
			var $this = $(this);
			var $item = $this.parent().parent();
			index = $item.data('index');
			show_task_detail(index);
		});
		
	}
	//展示详情
	function show_task_detail(index) {
		render_task_detail(index);
		current_index = index;
		$task_detail.show();
		$task_detail_mask.show();
	}

	function hide_task_detail() {
		$task_detail.hide();
		$task_detail_mask.hide();
	}

	//感觉可以改进
	function listen_task_delete() {
		$task_delete_trigger.on('click', function() {
			var $this = $(this);
			var $item = $this.parent().parent();
			var index = $item.data('index');
			pop('确定删除该项？').then(function(r) {
				r ? delete_task(index) : null;
			});
		});
	}
	//监听task完成事件。
	function listen_checkbox_complete() {
		$checkbox_complete.on('click', function() {
			var $this = $(this);
			var index = $this.parent().parent().data('index');
			var item = get(index);
			if (item && item.complete) {
				update_task(index, {complete : false});
			} else {
				update_task(index, {complete : true});
			}
		});
	}

	function get(index) {
    		return store.get('task_list')[index];
 	 }

	function add_task(new_task) {
		// 将新任务推入任务列表
		task_list.push(new_task);
		refresh_task_list();
		return true;
	}
	//更新localStorage并且渲染tpl
	function refresh_task_list() {
		//实现数据的localStorage
		store.set('task_list', task_list);
		//对任务列表进行渲染
		render_task_list();
	}
	function delete_task(index) {
		if (index === undefined || !task_list[index]) {
			return;
		}
		delete task_list[index];
		refresh_task_list();
	}
	//渲染task详情
	function render_task_detail(index) {
		if (index === undefined || !task_list[index]) {
			return false;
		}
		var item = task_list[index];
		var tpl = '<form>' +
				'<div class="content">' + item.content + '</div>' +
				'<div class="input-item"><input type="text" style="display: none;" name="content" value="' + item.content +'" /></div>' +
				'<div class="desc input-item">' +
					'<textarea name="desc">' + (item.desc || ' ') +
					'</textarea>' +
				'</div>' +
				'<div class="remind input-item">' + '<label>提醒时间：</label>' +
					'<input class="datetime" type="text" name="remind_date" value="' + (item.remind_date || '') + '">' +
				'</div>' + '<div class="input-item"><button type="submit">更新</button></div>' +  
			'</form>';
		//每次调用详情栏前，要进行清空
		$task_detail.html(null);
		$task_detail.append(tpl);
		//设置时间插件
		$('.datetime').datetimepicker();
		//选中form元素，为下步的监听做准备
		$update_form = $task_detail.find('form');
		//找到任务详情的题目
		$task_detail_content = $update_form.find('.content');
		//找到替换任务详情题目的输入框
		$task_detail_content_input = $update_form.find('[name="content"]');
		//任务详情题目绑定双击事件
		$task_detail_content.on('dblclick', function() {
			$task_detail_content_input.show();
			$task_detail_content.hide();
		})
		//触发submit事件，获取各项数据，调用update_task()进行更新，最后自动隐藏详情界面
		$update_form.on('submit', function(e) {
			e.preventDefault();
			var data = {};
			data.content = $(this).find('[name="content"]').val();
			data.desc= $(this).find('[name="desc"]').val();
			data.remind_date= $(this).find('[name="remind_date"]').val();
			update_task(index, data);
			hide_task_detail();
		});
	}
	//更新任务
	//data是一个动态对象，用来获取desc和日期，之后传进update_task，实现task_list[index]的更新
	function update_task(index, data) {
		if (index === undefined || !task_list[index]) {
			return;
		}
		//对数组元素进行更新
		task_list[index] = $.extend({}, task_list[index], data);
		//刷新任务列表
		refresh_task_list();
	}
	//渲染task列表
	function render_task_list() {
		var $task_list = $('.task-list');
		//每次清空任务列表
		$task_list.html('');
		//定义空数组，用来存放checkbox为checked的完成事件。
		var complete_items = [];
		//此处存在问题，这样写的效率很低下
		//先对未完成的任务进行渲染
		for(var i = 0; i < task_list.length; i++) {
			var item = task_list[i];
			if (item && item.complete) {
				//没有采用push的方法，是为了使得完成的task依旧有序
				complete_items[i] = item;
			} else {
				var $task = render_task_item(task_list[i], i);
			}
			$task_list.prepend($task);
		}
		//对完成的任务进行渲染
		for(var j = 0; j < complete_items.length; j++) {
			$task = render_task_item(complete_items[j], j);
			if (!$task) {
				continue;
			} else {
				$task.addClass('completed');
				$task_list.append($task);
			}
			
		}
		//渲染完毕，对$delete_task进行赋值操作
		$task_delete_trigger = $('.action.delete');
		$task_detail_trigger = $('.action.detail');
		$checkbox_complete = $('.task-list .complete[type="checkbox"]');
		listen_task_delete();
		listen_task_detail() ;
		listen_checkbox_complete();	
	}
	//渲染单条task模板
	function render_task_item(data, index) {
		if (!data || !index) {
			return;
		}
		//此处直接控制复选框状态
		var list_item_tpl = '<div class="task-item" data-index="' + index + '">' +
				'<span><input type="checkbox" class="complete" + ' + (data.complete ? 'checked' : '') + '></span>' +
				'<span class="task-content">' + data.content + '</span>' +
				'<span class="fr">' + 
					'<span class="action delete"> 删除</span>' +
					'<span class="action detail"> 详情</span>' +
				'</span>' + '</div>';
		return $(list_item_tpl);
	}
	
	
})();