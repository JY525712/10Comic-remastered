const fs = require('node:fs')
const path = require('node:path')

// Fragments intentionally share the original UI closure. No runtime loader,
// additional globals or network dependency is introduced into the userscript.
function composeUI(source, sourceRoot) {
  const directory = path.join(sourceRoot, 'ui')
  const replace = (marker, content) => {
    if (source.split(marker).length !== 2) throw new Error(`Expected one UI slot: ${marker}`)
    source = source.replace(marker, () => content)
  }
  const styleSlot = source.match(/\/\*__UI_STYLE__\*\/\s*""/)
  if (!styleSlot) throw new Error('Missing UI style slot')
  let styles = fs.readFileSync(path.join(directory, 'styles.css'), 'utf8')
  if (styles.split('/*__THEME_COMPONENT_STYLES__*/').length !== 2) throw new Error('Expected one theme component style slot')
  const themeStyles = ['light-themes.css', 'premium-themes.css', 'theme-menus.css', 'launcher-effects.css'].map(name => fs.readFileSync(path.join(directory, name), 'utf8')).join('\n')
  styles = styles.replace('/*__THEME_COMPONENT_STYLES__*/', () => themeStyles)
  styles += '\n' + fs.readFileSync(path.join(directory, 'rule-workbench.css'), 'utf8')
  replace(styleSlot[0], JSON.stringify(styles))
  for (const name of ['shell', 'sites', 'chapters', 'tasks', 'rules', 'rule-workbench', 'rule-management', 'accessibility']) {
    replace(`/*__UI_${name.toUpperCase()}__*/`, fs.readFileSync(path.join(directory, name + '.js'), 'utf8').trim())
  }
  return source
}

module.exports = { composeUI }
