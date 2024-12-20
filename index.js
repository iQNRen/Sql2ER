const canvas = document.getElementById('erDiagram');
const ctx = canvas.getContext('2d');
const sqlInput = document.getElementById('sqlInput');
const generateButton = document.getElementById('generateButton');

// 拖动相关变量
let isDragging = false;
let isResizing = false;
let selectedNode = null;
let offsetX = 0;
let offsetY = 0;
let resizeOffset = 0;
let zoomLevel = 1;

// 实体和属性的定义
let entities = [];

// 动态调整Canvas大小
function resizeCanvas() {
    const leftContainer = document.querySelector('.left');
    canvas.width = leftContainer.clientWidth; // 设置 Canvas 宽度为父容器的宽度
    canvas.height = leftContainer.clientHeight; // 设置 Canvas 高度为父容器的高度
    drawERDiagram(); // 重新绘制图表
}

// 监听窗口大小变化
window.addEventListener('resize', resizeCanvas);

// 初始化Canvas大小
resizeCanvas();

// 解析SQL语句
function parseSQL(sql) {
    // 预处理：去掉所有反引号符号
    sql = sql.replace(/`/g, '');

    // 预处理：仅删除括号内包含数字的部分
    sql = sql.replace(/\s*\(\s*\d+\s*\)/g, '');

    const tables = [];
    const regex = /CREATE\s+TABLE\s+([^\s(]+)\s*\(([^)]+)\)/g;
    let match;

    while ((match = regex.exec(sql)) !== null) {
        const tableName = match[1].trim();
        const columns = match[2].split(/,\s*(?![^()]*\))/g).map(col => col.trim());
        const table = {
            name: tableName,
            attributes: [],
            foreignKeys: [],
        };

        columns.forEach(col => {
            const colMatch = col.match(/^\s*([^\s]+)\s+([^\s]+)(\s+PRIMARY\s+KEY)?(\s+REFERENCES\s+([^\s(]+)\s*\(([^\s)]+)\))?/i);
            if (colMatch) {
                const attribute = {
                    name: colMatch[1],
                    type: colMatch[2],
                    isPrimaryKey: !!colMatch[3],
                };
                if(colMatch[1]!='PRIMARY') table.attributes.push(attribute);

                if (colMatch[4]) {
                    table.foreignKeys.push({
                        attribute: colMatch[1],
                        referencedTable: colMatch[5],
                        referencedAttribute: colMatch[6],
                    });
                }
            }
        });

        tables.push(table);
    }

    return tables;
}

// 布局实体和属性节点
function layoutNodes(tables) {
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const entityRadius = Math.min(canvas.width, canvas.height) / 2;
    const attributeRadius = entityRadius / 2;

    entities = tables.map((table, index) => {
        const angle = (2 * Math.PI * index) / tables.length;
        const x = centerX + entityRadius * Math.cos(angle);
        const y = centerY + entityRadius * Math.sin(angle);

        const entity = {
            name: table.name,
            attributes: table.attributes.map((attr, attrIndex) => {
                const attrAngle = (2 * Math.PI * attrIndex) / table.attributes.length;
                return {
                    name: attr.name,
                    x: x + attributeRadius * Math.cos(attrAngle),
                    y: y + attributeRadius * Math.sin(attrAngle),
                    radius: 45,
                };
            }),
            x,
            y,
            radius: 50,
            foreignKeys: table.foreignKeys, // 添加外键信息
        };

        return entity;
    });
}

// 绘制圆形节点
function drawCircleNode(node) {
    ctx.fillStyle = 'white';
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fill();

    ctx.fillStyle = 'black';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(node.name, node.x, node.y);
}

// 计算从圆边缘到另一个圆边缘的连线点
function getEdgePoint(node1, node2) {
    const dx = node2.x - node1.x;
    const dy = node2.y - node1.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    const edgeX = node1.x + (dx / distance) * node1.radius;
    const edgeY = node1.y + (dy / distance) * node1.radius;

    return { x: edgeX, y: edgeY };
}

// 绘制箭头
function drawArrow(fromX, fromY, toX, toY) {
    const headLength = 10;
    const angle = Math.atan2(toY - fromY, toX - fromX);

    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(toX, toY);
    ctx.lineTo(
        toX - headLength * Math.cos(angle - Math.PI / 6),
        toY - headLength * Math.sin(angle - Math.PI / 6)
    );
    ctx.lineTo(
        toX - headLength * Math.cos(angle + Math.PI / 6),
        toY - headLength * Math.sin(angle + Math.PI / 6)
    );
    ctx.closePath();
    ctx.fillStyle = 'black';
    ctx.fill();
}

// 绘制关系
function drawRelationships() {
    entities.forEach(entity => {
        entity.attributes.forEach(attrNode => {
            const fromEdge = getEdgePoint(entity, attrNode);
            const toEdge = getEdgePoint(attrNode, entity);
            drawArrow(fromEdge.x, fromEdge.y, toEdge.x, toEdge.y);
        });
    });

    entities.forEach(entity => {
        entity.foreignKeys.forEach(foreignKey => {
            const referencedEntity = entities.find(e => e.name === foreignKey.referencedTable);
            if (referencedEntity) {
                const fromEdge = getEdgePoint(entity, referencedEntity);
                const toEdge = getEdgePoint(referencedEntity, entity);
                drawArrow(fromEdge.x, fromEdge.y, toEdge.x, toEdge.y);
            }
        });
    });
}

// 绘制所有节点和关系
function drawERDiagram() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    entities.forEach(entity => {
        drawCircleNode(entity);
        entity.attributes.forEach(attrNode => drawCircleNode(attrNode));
    });
    drawRelationships();
}

// 检查是否点击了节点
function isPointInNode(x, y, node) {
    const dx = x - node.x;
    const dy = y - node.y;
    return dx * dx + dy * dy <= node.radius * node.radius;
}

// 鼠标按下事件
canvas.addEventListener('mousedown', (event) => {
    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    selectedNode = [...entities, ...entities.flatMap(e => e.attributes)].find(node => isPointInNode(mouseX, mouseY, node));
    if (selectedNode) {
        const dx = mouseX - selectedNode.x;
        const dy = mouseY - selectedNode.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance >= selectedNode.radius - 5 && distance <= selectedNode.radius + 5) {
            // 点击了圆的边缘，开始调整大小
            isResizing = true;
            resizeOffset = distance - selectedNode.radius;
        } else {
            // 点击了圆的内部，开始拖动
            isDragging = true;
            offsetX = mouseX - selectedNode.x;
            offsetY = mouseY - selectedNode.y;
        }
    }
});

// 鼠标移动事件
canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    if (isDragging) {
        selectedNode.x = mouseX - offsetX;
        selectedNode.y = mouseY - offsetY;
        drawERDiagram();
    } else if (isResizing) {
        const distance = Math.sqrt((mouseX - selectedNode.x) ** 2 + (mouseY - selectedNode.y) ** 2);
        selectedNode.radius = distance - resizeOffset;
        drawERDiagram();
    }
});

// 鼠标松开事件
canvas.addEventListener('mouseup', () => {
    isDragging = false;
    isResizing = false;
    selectedNode = null;
});

// 生成ER图
generateButton.addEventListener('click', () => {
    const sql = sqlInput.value;
    const tables = parseSQL(sql);
    layoutNodes(tables);
    drawERDiagram();
});

// 右键删除功能
canvas.addEventListener('contextmenu', (event) => {
    event.preventDefault();

    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    const clickedNode = [...entities, ...entities.flatMap(e => e.attributes)].find(node => isPointInNode(mouseX, mouseY, node));
    if (clickedNode) {
        const confirmDelete = confirm(`是否删除节点 "${clickedNode.name}"?`);
        if (confirmDelete) {
            if (clickedNode.attributes) {
                entities = entities.filter(entity => entity !== clickedNode);
            } else {
                const parentEntity = entities.find(entity => entity.attributes.includes(clickedNode));
                parentEntity.attributes = parentEntity.attributes.filter(attr => attr !== clickedNode);
            }

            drawERDiagram();
        }
    }
});

// 鼠标滚动+Ctrl键缩放
canvas.addEventListener('wheel', (event) => {
    event.preventDefault();

    if (!event.ctrlKey) return;

    const zoomFactor = 0.1;
    const delta = event.deltaY > 0 ? -1 : 1;

    zoomLevel += delta * zoomFactor;
    zoomLevel = Math.max(0.5, Math.min(2, zoomLevel));

    ctx.save();
    ctx.scale(zoomLevel, zoomLevel);
    drawERDiagram();
    ctx.restore();
});

// 双击事件：修改节点名称
canvas.addEventListener('dblclick', (event) => {
    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    const clickedNode = [...entities, ...entities.flatMap(e => e.attributes)].find(node => isPointInNode(mouseX, mouseY, node));
    if (clickedNode) {
        const newName = prompt(`修改节点名称（当前名称：${clickedNode.name}）`, clickedNode.name);
        if (newName !== null && newName.trim() !== '') {
            clickedNode.name = newName.trim();
            drawERDiagram();
        }
    }
});